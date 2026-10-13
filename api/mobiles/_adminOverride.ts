import { ApiAuthError, authErrorResponse, requireRole } from "../_requireAuth.js";
import { getSheetsClient, requireSpreadsheetId } from "../_googleSheets.js";

// Ações exclusivas do Administrador no Controle de Mobiles (exceção às regras dos processos):
// - "edit": sobrescreve qualquer campo de um registro (empréstimo, manutenção externa,
//   substituição ou cadastro do coletor);
// - "rollback": desfaz a última etapa de um processo, devolvendo os coletores ao estado anterior.
// Toda ação grava uma linha em tbAuditoriaMobiles na mesma gravação dos dados.
// Roteado por /api/update (adminAction) para não exceder o limite de funções serverless.

const CONTROL = "tbControleMobiles";
const LOANS = "tbEmprestimosMobiles";
const EXTERNAL = "tbManutencaoExternaMobiles";
const REPLACEMENTS = "tbSubstituicoesMobiles";
const APPS = "tbMobileApps";
export const AUDIT_SHEET = "tbAuditoriaMobiles";
export const AUDIT_HEADERS = [
  "ID_AUDITORIA",
  "DATA",
  "ADMIN",
  "ACAO",
  "PROCESSO",
  "ABA",
  "REGISTRO",
  "CAMPOS_ALTERADOS",
  "MOTIVO",
  "DADOS_ANTES",
  "DADOS_DEPOIS",
];

const EDITABLE_SHEETS: Record<string, string> = {
  [CONTROL]: "Cadastro do coletor",
  [LOANS]: "Empréstimo",
  [EXTERNAL]: "Manutenção externa",
  [REPLACEMENTS]: "Substituição",
};

const LOAN_RETURN_FIELDS = [
  "DATA_DEVOLUCAO",
  "RESPONSAVEL_DEVOLUCAO",
  "COLABORADOR_DEVOLUCAO_NOME",
  "COLABORADOR_DEVOLUCAO_MATRICULA",
  "COLABORADOR_DEVOLUCAO_CARGO",
  "CONDICAO_DEVOLUCAO",
  "DETALHES_DEVOLUCAO",
  "OBS_DEVOLUCAO",
  "TIPO_OCORRENCIA_DEVOLUCAO",
  "JUSTIFICATIVA_MAU_USO",
  "RESPONSAVEL_SETOR_NOME",
  "TERMO_RESPONSABILIDADE_EMITIDO",
];

const EXTERNAL_RETURN_FIELDS = [
  "DATA_RETORNO",
  "RESPONSAVEL_RETORNO",
  "COLABORADOR_RETORNO_NOME",
  "COLABORADOR_RETORNO_MATRICULA",
  "COLABORADOR_RETORNO_CARGO",
  "SETOR_RETORNO",
  "SERVICO_REALIZADO",
  "OBS_RETORNO",
];

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const text = (value: unknown) => String(value ?? "").trim();

class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const now = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo", hour12: false }).replace(" ", "T");

const makeId = () =>
  `AUD${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const columnIndex = (headers: string[], ...names: string[]) =>
  headers.findIndex((header) => names.some((name) => normalize(header) === normalize(name)));

// Algumas abas têm cabeçalhos repetidos (ex.: DATA_DEVOLUCAO em tbEmprestimosMobiles).
const columnIndexes = (headers: string[], name: string) =>
  headers.map((header, index) => (normalize(header) === normalize(name) ? index : -1)).filter((index) => index !== -1);

const pad = (row: string[] | undefined, length: number) => {
  const copy = [...(row || [])].map((value) => String(value ?? ""));
  while (copy.length < length) copy.push("");
  return copy;
};

interface SheetData {
  name: string;
  values: string[][];
  headers: string[];
}

interface RowChange {
  sheet: SheetData;
  sheetRow: number;
  before: string[];
  after: string[];
}

async function loadSheet(sheets: any, spreadsheetId: string, name: string, optional = false): Promise<SheetData | null> {
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${name}!A:AZ` });
    const values = ((response.data.values || []) as string[][]).map((row) => row.map((value) => String(value ?? "")));
    if (values.length === 0) throw new ValidationError(`A aba ${name} não possui cabeçalho.`);
    return { name, values, headers: values[0] };
  } catch (error: any) {
    if (/parse range/i.test(String(error?.message || ""))) {
      if (optional) return null;
      throw new ValidationError(`A aba ${name} não existe na planilha.`);
    }
    throw error;
  }
}

async function loadAudit(sheets: any, spreadsheetId: string) {
  const audit = await loadSheet(sheets, spreadsheetId, AUDIT_SHEET, true);
  if (!audit) {
    throw new ValidationError(`A aba ${AUDIT_SHEET} não existe na planilha. Crie a aba com os cabeçalhos: ${AUDIT_HEADERS.join(", ")}.`);
  }
  const missing = AUDIT_HEADERS.filter((header) => columnIndex(audit.headers, header) === -1);
  if (missing.length > 0) throw new ValidationError(`A aba ${AUDIT_SHEET} não possui as colunas: ${missing.join(", ")}.`);
  return audit;
}

const describeChanges = (changes: RowChange[]) =>
  changes
    .flatMap((change) =>
      change.sheet.headers
        .map((header, index) => ({ header, index }))
        .filter(({ index }) => text(change.before[index]) !== text(change.after[index]))
        .map(({ header, index }) => `${change.sheet.name}!L${change.sheetRow} ${header || `col${index + 1}`}: "${text(change.before[index])}" → "${text(change.after[index])}"`)
    )
    .join("; ");

const snapshot = (changes: RowChange[], side: "before" | "after") => {
  const json = JSON.stringify(
    changes.map((change) => ({
      aba: change.sheet.name,
      linha: change.sheetRow,
      valores: change.sheet.headers.map((header, index) => [header, change[side][index] ?? ""]),
    }))
  );
  // Limite de caracteres por célula do Google Sheets.
  return json.length > 45000 ? `${json.slice(0, 45000)}…` : json;
};

async function commit(
  sheets: any,
  spreadsheetId: string,
  admin: string,
  action: "EDICAO" | "ROLLBACK",
  process: string,
  record: string,
  reason: string,
  changes: RowChange[]
) {
  const effective = changes.filter((change) => change.before.some((value, index) => text(value) !== text(change.after[index])) || change.after.length !== change.before.length);
  if (effective.length === 0) throw new ValidationError("Nenhuma alteração foi informada.");

  const audit = await loadAudit(sheets, spreadsheetId);
  const entry: Record<string, string> = {
    ID_AUDITORIA: makeId(),
    DATA: now(),
    ADMIN: admin,
    ACAO: action,
    PROCESSO: process,
    ABA: [...new Set(effective.map((change) => change.sheet.name))].join(", "),
    REGISTRO: record,
    CAMPOS_ALTERADOS: describeChanges(effective).slice(0, 45000),
    MOTIVO: reason,
    DADOS_ANTES: snapshot(effective, "before"),
    DADOS_DEPOIS: snapshot(effective, "after"),
  };
  const auditRow = audit.headers.map((header) => {
    const key = AUDIT_HEADERS.find((name) => normalize(name) === normalize(header));
    return key ? entry[key] : "";
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        ...effective.map((change) => ({ range: `${change.sheet.name}!A${change.sheetRow}`, values: [change.after] })),
        { range: `${AUDIT_SHEET}!A${audit.values.length + 1}`, values: [auditRow] },
      ],
    },
  });

  return entry;
}

// ---------- Edição livre de registro ----------

async function editRecord(body: any, admin: string, reason: string) {
  const sheetName = text(body.sheet);
  if (!EDITABLE_SHEETS[sheetName]) throw new ValidationError("Aba não permitida para edição administrativa.");
  const rowIndex = Number(body.rowIndex);
  if (!Number.isInteger(rowIndex) || rowIndex < 2) throw new ValidationError("Linha inválida.");
  if (!Array.isArray(body.values) || !Array.isArray(body.expected)) throw new ValidationError("Dados do registro inválidos.");

  const sheets = getSheetsClient();
  const spreadsheetId = requireSpreadsheetId();
  const sheet = (await loadSheet(sheets, spreadsheetId, sheetName))!;
  const width = Math.max(sheet.headers.length, body.values.length);
  const current = pad(sheet.values[rowIndex - 1], width);
  const expected = pad(body.expected, width);

  // Proteção contra sobrescrever um registro que mudou depois de aberto na tela.
  if (current.some((value, index) => text(value) !== text(expected[index]))) {
    throw new ValidationError("O registro foi alterado por outra operação desde que foi aberto. Atualize a tela e tente novamente.", 409);
  }

  const after = pad(body.values.map((value: unknown) => text(value)), width);
  const idIndex = columnIndex(sheet.headers, "ID_EMPRESTIMO", "ID_MANUTENCAO", "ID_SUBSTITUICAO");
  const record =
    idIndex !== -1
      ? text(current[idIndex])
      : [text(current[columnIndex(sheet.headers, "Coletor")]), text(current[columnIndex(sheet.headers, "SN")])].filter(Boolean).join(" / ");

  return commit(sheets, spreadsheetId, admin, "EDICAO", EDITABLE_SHEETS[sheetName], record || `linha ${rowIndex}`, reason, [
    { sheet, sheetRow: rowIndex, before: current, after },
  ]);
}

// ---------- Rollback ----------

interface ControlCtx {
  sheet: SheetData;
  idx: { coletor: number; sn: number; status: number; local: number; setor: number; mac: number; final: number };
}

const controlContext = (sheet: SheetData): ControlCtx => {
  const idx = {
    coletor: columnIndex(sheet.headers, "Coletor"),
    sn: columnIndex(sheet.headers, "SN"),
    status: columnIndex(sheet.headers, "Status"),
    local: columnIndex(sheet.headers, "Setor localizado"),
    setor: columnIndex(sheet.headers, "Setor"),
    mac: columnIndex(sheet.headers, "MAC"),
    final: columnIndex(sheet.headers, "Final", "FINAL"),
  };
  if ([idx.coletor, idx.sn, idx.status, idx.local, idx.setor].some((value) => value === -1)) {
    throw new ValidationError(`A estrutura de ${CONTROL} está incompleta.`);
  }
  return { sheet, idx };
};

const findEquipment = (ctx: ControlCtx, coletor: string, sn: string, allowedStatus: string[], label: string) => {
  const matches = ctx.sheet.values
    .slice(1)
    .map((row, index) => ({ row, sheetRow: index + 2 }))
    .filter(({ row }) => normalize(row[ctx.idx.coletor]) === normalize(coletor) && (!sn || normalize(row[ctx.idx.sn]) === normalize(sn)));
  if (matches.length !== 1) {
    throw new ValidationError(`Não foi possível identificar um único cadastro para ${label} "${coletor}"${sn ? ` (SN ${sn})` : ""}.`, 409);
  }
  const status = text(matches[0].row[ctx.idx.status]).toUpperCase();
  if (!allowedStatus.includes(status)) {
    throw new ValidationError(
      `Rollback bloqueado: ${label} "${coletor}" está com status ${status || "vazio"} e já participa de outro processo. Corrija o cadastro antes (edição admin) ou desfaça o processo mais recente primeiro.`,
      409
    );
  }
  return matches[0];
};

const assertNoOtherActive = (ctx: ControlCtx, coletor: string, exceptRow: number) => {
  const conflict = ctx.sheet.values
    .slice(1)
    .some((row, index) => index + 2 !== exceptRow && normalize(row[ctx.idx.coletor]) === normalize(coletor) && text(row[ctx.idx.status]).toUpperCase() === "A");
  if (conflict) throw new ValidationError(`Já existe outro coletor ATIVO com o nome "${coletor}".`, 409);
};

const setControl = (ctx: ControlCtx, found: { row: string[]; sheetRow: number }, status: string, local: string): RowChange => {
  const before = pad(found.row, ctx.sheet.headers.length);
  const after = [...before];
  after[ctx.idx.status] = status;
  after[ctx.idx.local] = local;
  return { sheet: ctx.sheet, sheetRow: found.sheetRow, before, after };
};

const findById = (sheet: SheetData, idColumn: string, id: string) => {
  const idIndex = columnIndex(sheet.headers, idColumn);
  if (idIndex === -1) throw new ValidationError(`A aba ${sheet.name} não possui a coluna ${idColumn}.`);
  const matches = sheet.values
    .slice(1)
    .map((row, index) => ({ row, sheetRow: index + 2 }))
    .filter(({ row }) => normalize(row[idIndex]) === normalize(id));
  if (matches.length !== 1) throw new ValidationError(`Registro "${id}" não encontrado (ou duplicado) em ${sheet.name}.`, 409);
  return matches[0];
};

const field = (sheet: SheetData, row: string[], name: string) => {
  const index = columnIndex(sheet.headers, name);
  return index === -1 ? "" : text(row[index]);
};

async function rollbackLoan(id: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = requireSpreadsheetId();
  const [loans, control] = await Promise.all([loadSheet(sheets, spreadsheetId, LOANS), loadSheet(sheets, spreadsheetId, CONTROL)]);
  const ctx = controlContext(control!);
  const loan = findById(loans!, "ID_EMPRESTIMO", id);
  const status = normalize(field(loans!, loan.row, "STATUS_EMPRESTIMO"));
  const reserve = field(loans!, loan.row, "COLETOR_RESERVA");
  const reserveSn = field(loans!, loan.row, "SN_RESERVA");
  const original = field(loans!, loan.row, "COLETOR_SUBSTITUIDO");
  const originalSn = field(loans!, loan.row, "SN_SUBSTITUIDO");
  const destination = field(loans!, loan.row, "SETOR_DESTINO");
  const statusIdx = columnIndex(loans!.headers, "STATUS_EMPRESTIMO");

  const loanBefore = pad(loan.row, loans!.headers.length);
  const loanAfter = [...loanBefore];
  const changes: RowChange[] = [];
  let description = "";

  if (status === "aberto") {
    // Aberto → Cancelado: reserva volta disponível no TI-SUPORTE e o original volta ao setor.
    const reserveRow = findEquipment(ctx, reserve, reserveSn, ["E"], "a reserva");
    const originalRow = findEquipment(ctx, original, originalSn, ["M"], "o coletor substituído");
    assertNoOtherActive(ctx, original, originalRow.sheetRow);
    assertNoOtherActive(ctx, reserve, reserveRow.sheetRow);
    const originalSector = text(originalRow.row[ctx.idx.setor]);
    changes.push(setControl(ctx, reserveRow, "A", "TI-SUPORTE"));
    changes.push(setControl(ctx, originalRow, "A", destination || originalSector));
    loanAfter[statusIdx] = "CANCELADO";
    description = "Empréstimo aberto → cancelado";
  } else if (status === "finalizado" || status === "cancelado") {
    // Finalizado/Cancelado → Aberto: reserva volta emprestada no destino e o original volta para manutenção.
    const otherOpen = loans!.values.slice(1).some((row, index) => {
      if (index + 2 === loan.sheetRow || normalize(row[statusIdx]) !== "aberto") return false;
      return [field(loans!, row, "COLETOR_RESERVA"), field(loans!, row, "COLETOR_SUBSTITUIDO")].some(
        (coletor) => normalize(coletor) === normalize(reserve) || normalize(coletor) === normalize(original)
      );
    });
    if (otherOpen) throw new ValidationError("Rollback bloqueado: a reserva ou o coletor substituído já está em outro empréstimo aberto.", 409);
    const reserveRow = findEquipment(ctx, reserve, reserveSn, ["A", "M"], "a reserva");
    const originalRow = findEquipment(ctx, original, originalSn, ["A"], "o coletor substituído");
    changes.push(setControl(ctx, reserveRow, "E", destination || text(reserveRow.row[ctx.idx.local])));
    changes.push(setControl(ctx, originalRow, "M", "TI-SUPORTE"));
    loanAfter[statusIdx] = "ABERTO";
    if (status === "finalizado") {
      LOAN_RETURN_FIELDS.forEach((name) => columnIndexes(loans!.headers, name).forEach((index) => { loanAfter[index] = ""; }));
    }
    description = status === "finalizado" ? "Empréstimo finalizado → aberto (devolução desfeita)" : "Empréstimo cancelado → aberto";
  } else {
    throw new ValidationError(`Status do empréstimo não suportado para rollback: ${field(loans!, loan.row, "STATUS_EMPRESTIMO") || "vazio"}.`);
  }

  changes.unshift({ sheet: loans!, sheetRow: loan.sheetRow, before: loanBefore, after: loanAfter });
  return { sheets, spreadsheetId, process: "Empréstimo", record: id, description, changes };
}

const revertReplacement = (
  ctx: ControlCtx,
  apps: SheetData | null,
  replacements: SheetData,
  replacement: { row: string[]; sheetRow: number },
  allowedStatus: string[]
) => {
  const coletor = field(replacements, replacement.row, "COLETOR");
  const snNew = field(replacements, replacement.row, "SN_NOVO");
  const snOld = field(replacements, replacement.row, "SN_ANTERIOR");
  const equipment = findEquipment(ctx, coletor, snNew, allowedStatus, "o coletor");
  const snInUse = ctx.sheet.values.slice(1).some((row, index) => index + 2 !== equipment.sheetRow && snOld && normalize(row[ctx.idx.sn]) === normalize(snOld));
  if (snInUse) throw new ValidationError(`Rollback bloqueado: o SN anterior "${snOld}" já está cadastrado em outro equipamento.`, 409);

  const before = pad(equipment.row, ctx.sheet.headers.length);
  const after = [...before];
  after[ctx.idx.sn] = snOld;
  if (ctx.idx.mac !== -1) after[ctx.idx.mac] = field(replacements, replacement.row, "MAC_ANTERIOR");
  if (ctx.idx.final !== -1) after[ctx.idx.final] = field(replacements, replacement.row, "FINAL_ANTERIOR");
  const changes: RowChange[] = [{ sheet: ctx.sheet, sheetRow: equipment.sheetRow, before, after }];

  if (apps) {
    const appColetor = columnIndex(apps.headers, "COLETOR");
    const appSn = columnIndex(apps.headers, "SN");
    if (appColetor !== -1 && appSn !== -1) {
      apps.values.slice(1).forEach((row, index) => {
        if (normalize(row[appColetor]) !== normalize(coletor)) return;
        const appBefore = pad(row, apps.headers.length);
        const appAfter = [...appBefore];
        appAfter[appSn] = snOld;
        changes.push({ sheet: apps, sheetRow: index + 2, before: appBefore, after: appAfter });
      });
    }
  }

  // O registro de substituição é removido do histórico ativo (cópia integral fica na auditoria).
  const replacementBefore = pad(replacement.row, replacements.headers.length);
  changes.push({ sheet: replacements, sheetRow: replacement.sheetRow, before: replacementBefore, after: replacementBefore.map(() => "") });
  return { changes, equipment, after };
};

async function rollbackExternal(id: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = requireSpreadsheetId();
  const [external, control, replacements, apps] = await Promise.all([
    loadSheet(sheets, spreadsheetId, EXTERNAL),
    loadSheet(sheets, spreadsheetId, CONTROL),
    loadSheet(sheets, spreadsheetId, REPLACEMENTS, true),
    loadSheet(sheets, spreadsheetId, APPS, true),
  ]);
  const ctx = controlContext(control!);
  const record = findById(external!, "ID_MANUTENCAO", id);
  const status = normalize(field(external!, record.row, "STATUS_MANUTENCAO"));
  const coletor = field(external!, record.row, "COLETOR");
  const sn = field(external!, record.row, "SN");
  const statusIdx = columnIndex(external!.headers, "STATUS_MANUTENCAO");
  const recordBefore = pad(record.row, external!.headers.length);
  const recordAfter = [...recordBefore];
  const changes: RowChange[] = [];
  let description = "";

  if (status === "aberta") {
    // Aberta → Cancelada: coletor volta Ativo na localização anterior ao envio.
    const equipment = findEquipment(ctx, coletor, sn, ["M"], "o coletor");
    assertNoOtherActive(ctx, coletor, equipment.sheetRow);
    const previous = field(external!, record.row, "LOCALIZACAO_ANTERIOR") || field(external!, record.row, "SETOR_ORIGEM");
    changes.push(setControl(ctx, equipment, "A", previous));
    recordAfter[statusIdx] = "CANCELADA";
    description = "Manutenção externa aberta → cancelada (envio desfeito)";
  } else if (status === "finalizada" || status === "cancelada") {
    // Finalizada/Cancelada → Aberta: coletor volta para MANUTENÇÃO EXTERNA (desfazendo substituição, se houver).
    const linked = replacements
      ? replacements.values
          .slice(1)
          .map((row, index) => ({ row, sheetRow: index + 2 }))
          .filter(({ row }) => normalize(field(replacements, row, "ID_MANUTENCAO")) === normalize(id) && field(replacements, row, "COLETOR"))
      : [];
    if (linked.length > 1) throw new ValidationError("Há mais de uma substituição vinculada a esta manutenção. Desfaça as substituições individualmente.", 409);

    if (linked.length === 1) {
      const reverted = revertReplacement(ctx, apps, replacements!, linked[0], ["A"]);
      const equipmentChange = reverted.changes[0];
      equipmentChange.after[ctx.idx.status] = "M";
      equipmentChange.after[ctx.idx.local] = "MANUTENÇÃO EXTERNA";
      changes.push(...reverted.changes);
      description = "Manutenção externa finalizada → aberta (retorno e substituição desfeitos)";
    } else {
      const equipment = findEquipment(ctx, coletor, sn, ["A"], "o coletor");
      changes.push(setControl(ctx, equipment, "M", "MANUTENÇÃO EXTERNA"));
      description = status === "finalizada" ? "Manutenção externa finalizada → aberta (retorno desfeito)" : "Manutenção externa cancelada → aberta";
    }
    recordAfter[statusIdx] = "ABERTA";
    if (status === "finalizada") {
      EXTERNAL_RETURN_FIELDS.forEach((name) => columnIndexes(external!.headers, name).forEach((index) => { recordAfter[index] = ""; }));
    }
  } else {
    throw new ValidationError(`Status da manutenção não suportado para rollback: ${field(external!, record.row, "STATUS_MANUTENCAO") || "vazio"}.`);
  }

  changes.unshift({ sheet: external!, sheetRow: record.sheetRow, before: recordBefore, after: recordAfter });
  return { sheets, spreadsheetId, process: "Manutenção externa", record: id, description, changes };
}

async function rollbackReplacement(id: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = requireSpreadsheetId();
  const [control, replacements, apps] = await Promise.all([
    loadSheet(sheets, spreadsheetId, CONTROL),
    loadSheet(sheets, spreadsheetId, REPLACEMENTS),
    loadSheet(sheets, spreadsheetId, APPS, true),
  ]);
  const ctx = controlContext(control!);
  const replacement = findById(replacements!, "ID_SUBSTITUICAO", id);
  const reverted = revertReplacement(ctx, apps, replacements!, replacement, ["A", "I", "M", "E"]);
  return { sheets, spreadsheetId, process: "Substituição", record: id, description: "Substituição desfeita (SN/MAC/Final anteriores restaurados)", changes: reverted.changes };
}

export async function handleAdminOverride(req: any, res: any) {
  try {
    const { decodedToken, role } = await requireRole(req.headers.authorization, ["admin"]);
    if (role !== "admin") throw new ApiAuthError("Ação exclusiva do Administrador.", 403);
    const admin = text(decodedToken.name || decodedToken.email);
    const body = req.body || {};
    const reason = text(body.reason);
    if (reason.length < 5) throw new ValidationError("Informe o motivo da alteração (mínimo de 5 caracteres).");

    if (body.adminAction === "edit") {
      const entry = await editRecord(body, admin, reason);
      return res.status(200).json({ success: true, auditId: entry.ID_AUDITORIA });
    }

    if (body.adminAction === "rollback") {
      const id = text(body.id);
      if (!id) throw new ValidationError("Registro não informado.");
      const result =
        body.process === "loan"
          ? await rollbackLoan(id)
          : body.process === "external"
            ? await rollbackExternal(id)
            : body.process === "replacement"
              ? await rollbackReplacement(id)
              : null;
      if (!result) throw new ValidationError("Processo inválido para rollback.");
      const entry = await commit(result.sheets, result.spreadsheetId, admin, "ROLLBACK", result.process, `${result.record} — ${result.description}`, reason, result.changes);
      return res.status(200).json({ success: true, auditId: entry.ID_AUDITORIA, description: result.description });
    }

    throw new ValidationError("Ação administrativa inválida.");
  } catch (error: any) {
    if (authErrorResponse(error, res)) return;
    if (error instanceof ValidationError) return res.status(error.statusCode).json({ error: error.message });
    console.error("ERRO ADMIN OVERRIDE:", error);
    return res.status(500).json({ error: error?.message || "Erro interno na ação administrativa." });
  }
}
