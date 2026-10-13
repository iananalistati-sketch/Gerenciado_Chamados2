import { ApiAuthError, authErrorResponse, requireRole } from "../_requireAuth.js";
import { getSheetsClient, requireSpreadsheetId } from "../_googleSheets.js";

// Ações exclusivas do Administrador no histórico do Controle de Mobiles:
// - "edit": modifica um processo EM ABERTO (empréstimo ou manutenção externa) em qualquer campo.
//   O registro é sobrescrito, recebe MODIFICADA_ADMIN = SIM e, se o equipamento ou o setor mudar,
//   o cadastro dos coletores envolvidos é ajustado na mesma gravação;
// - "delete": exclui um processo FINALIZADO/CANCELADO ou uma substituição. O registro sai da aba do
//   processo e a exclusão fica registrada somente na auditoria, com a cópia integral dos dados.
// Toda ação grava uma linha em tbAuditoriaMobiles (quem, quando, antes → depois e motivo).
// Roteado por /api/update (adminAction) para não exceder o limite de funções serverless.

const CONTROL = "tbControleMobiles";
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

const MODIFIED_COLUMN = "MODIFICADA_ADMIN";

type Process = "loan" | "external" | "replacement";

const PROCESSES: Record<Process, { title: string; sheet: string; idColumn: string; statusColumn: string; open: string; closed: string[] }> = {
  loan: { title: "Empréstimo", sheet: "tbEmprestimosMobiles", idColumn: "ID_EMPRESTIMO", statusColumn: "STATUS_EMPRESTIMO", open: "aberto", closed: ["finalizado", "cancelado"] },
  external: { title: "Manutenção externa", sheet: "tbManutencaoExternaMobiles", idColumn: "ID_MANUTENCAO", statusColumn: "STATUS_MANUTENCAO", open: "aberta", closed: ["finalizada", "cancelada"] },
  replacement: { title: "Substituição", sheet: "tbSubstituicoesMobiles", idColumn: "ID_SUBSTITUICAO", statusColumn: "", open: "", closed: [] },
};

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

// Cria a coluna MODIFICADA_ADMIN no fim do cabeçalho quando ainda não existe,
// ampliando a grade da aba se necessário. Assim as duas bases (produção e treinamento) se ajustam sozinhas.
async function ensureColumn(sheets: any, spreadsheetId: string, sheet: SheetData, header: string) {
  const existing = columnIndex(sheet.headers, header);
  if (existing !== -1) return existing;

  const index = sheet.headers.length;
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.columnCount)" });
  const properties = (meta.data.sheets || []).map((item: any) => item.properties).find((item: any) => item?.title === sheet.name);
  if (!properties) throw new ValidationError(`A aba ${sheet.name} não existe na planilha.`);
  if (index >= 52) throw new ValidationError(`A aba ${sheet.name} não tem espaço para a coluna ${header}.`);
  if ((properties.gridProperties?.columnCount || 0) <= index) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ appendDimension: { sheetId: properties.sheetId, dimension: "COLUMNS", length: index + 1 - properties.gridProperties.columnCount } }] },
    });
  }
  const letter = index < 26 ? String.fromCharCode(65 + index) : `A${String.fromCharCode(65 + index - 26)}`;
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${sheet.name}!${letter}1`, valueInputOption: "RAW", requestBody: { values: [[header]] } });
  sheet.headers = [...sheet.headers, header];
  sheet.values[0] = sheet.headers;
  return index;
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
  action: "EDICAO" | "EXCLUSAO",
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

const parseProcess = (value: unknown): Process => {
  if (value === "loan" || value === "external" || value === "replacement") return value;
  throw new ValidationError("Processo inválido para a ação administrativa.");
};

// ---------- Cadastro dos coletores (tbControleMobiles) ----------

interface ControlCtx {
  sheet: SheetData;
  idx: { coletor: number; sn: number; status: number; local: number };
  // Linhas já alteradas nesta operação, para encadear ajustes no mesmo coletor.
  pending: Map<number, RowChange>;
}

const controlContext = (sheet: SheetData): ControlCtx => {
  const idx = {
    coletor: columnIndex(sheet.headers, "Coletor"),
    sn: columnIndex(sheet.headers, "SN"),
    status: columnIndex(sheet.headers, "Status"),
    local: columnIndex(sheet.headers, "Setor localizado"),
  };
  if (Object.values(idx).some((value) => value === -1)) throw new ValidationError(`A estrutura de ${CONTROL} está incompleta.`);
  return { sheet, idx, pending: new Map() };
};

const findEquipment = (ctx: ControlCtx, coletor: string, sn: string, allowedStatus: string[], label: string) => {
  const byName = ctx.sheet.values
    .slice(1)
    .map((row, index) => ({ row, sheetRow: index + 2 }))
    .filter(({ row }) => normalize(row[ctx.idx.coletor]) === normalize(coletor));
  const bySn = sn ? byName.filter(({ row }) => normalize(row[ctx.idx.sn]) === normalize(sn)) : [];
  const byStatus = byName.filter(({ row }) => allowedStatus.includes(text(row[ctx.idx.status]).toUpperCase()));
  const matches = bySn.length === 1 ? bySn : byStatus.length > 0 ? byStatus : byName;
  if (matches.length !== 1) {
    throw new ValidationError(
      byName.length === 0
        ? `O ${label} "${coletor}" não está cadastrado no Controle de Mobiles.`
        : `Não foi possível identificar um único cadastro para o ${label} "${coletor}"${sn ? ` (SN ${sn})` : ""}.`,
      409
    );
  }
  const status = text(matches[0].row[ctx.idx.status]).toUpperCase();
  if (!allowedStatus.includes(status)) {
    throw new ValidationError(`O ${label} "${coletor}" está com status ${status || "vazio"} no cadastro e não pode ser usado nesta alteração.`, 409);
  }
  return matches[0];
};

const setControl = (ctx: ControlCtx, found: { row: string[]; sheetRow: number }, status: string, local: string) => {
  const existing = ctx.pending.get(found.sheetRow);
  const change = existing || { sheet: ctx.sheet, sheetRow: found.sheetRow, before: pad(found.row, ctx.sheet.headers.length), after: pad(found.row, ctx.sheet.headers.length) };
  change.after[ctx.idx.status] = status;
  change.after[ctx.idx.local] = local;
  ctx.pending.set(found.sheetRow, change);
  return change;
};

const serialOf = (ctx: ControlCtx, found: { row: string[] }) => text(found.row[ctx.idx.sn]);
const locationOf = (ctx: ControlCtx, found: { row: string[] }) => text(found.row[ctx.idx.local]);

// ---------- Edição de processo em aberto ----------

async function editOpenRecord(body: any, admin: string, reason: string) {
  const process = parseProcess(body.process);
  if (process === "replacement") throw new ValidationError("A substituição é um registro concluído: ela só pode ser excluída.");
  const config = PROCESSES[process];
  const id = text(body.id);
  if (!id) throw new ValidationError("Registro não informado.");
  if (!Array.isArray(body.values) || !Array.isArray(body.expected)) throw new ValidationError("Dados do registro inválidos.");

  const sheets = getSheetsClient();
  const spreadsheetId = requireSpreadsheetId();
  const [records, control] = await Promise.all([loadSheet(sheets, spreadsheetId, config.sheet), loadSheet(sheets, spreadsheetId, CONTROL)]);
  const sheet = records!;
  const modifiedIndex = await ensureColumn(sheets, spreadsheetId, sheet, MODIFIED_COLUMN);
  const record = findById(sheet, config.idColumn, id);
  const width = sheet.headers.length;
  const before = pad(record.row, width);

  if (normalize(field(sheet, before, config.statusColumn)) !== config.open) {
    throw new ValidationError("Somente processos em aberto podem ser modificados. Processos finalizados podem apenas ser excluídos.", 409);
  }

  // Proteção contra sobrescrever um registro que mudou depois de aberto na tela.
  const expected = pad(body.expected, width);
  if (before.some((value, index) => index !== modifiedIndex && text(value) !== text(expected[index]))) {
    throw new ValidationError("O registro foi alterado por outra operação desde que foi aberto. Atualize a tela e tente novamente.", 409);
  }

  const protectedIndexes = new Set(
    [config.idColumn, config.statusColumn, MODIFIED_COLUMN].map((name) => columnIndex(sheet.headers, name)).filter((index) => index !== -1)
  );
  const incoming = pad(body.values.map((value: unknown) => text(value)), width);
  const after = before.map((value, index) => (protectedIndexes.has(index) ? value : incoming[index] ?? ""));
  if (after.every((value, index) => text(value) === text(before[index]))) throw new ValidationError("Nenhum campo foi alterado.");

  const ctx = controlContext(control!);
  const set = (name: string, value: string) => {
    const index = columnIndex(sheet.headers, name);
    if (index !== -1) after[index] = value;
  };
  const changed = (name: string) => normalize(field(sheet, before, name)) !== normalize(field(sheet, after, name));
  let summary = "";

  if (process === "loan") {
    const reserveBefore = field(sheet, before, "COLETOR_RESERVA");
    const reserveAfter = field(sheet, after, "COLETOR_RESERVA");
    const originalBefore = field(sheet, before, "COLETOR_SUBSTITUIDO");
    const originalAfter = field(sheet, after, "COLETOR_SUBSTITUIDO");
    const destination = field(sheet, after, "SETOR_DESTINO");
    if (!reserveAfter || !originalAfter) throw new ValidationError("Informe o coletor reserva e o coletor substituído.");
    if (normalize(reserveAfter) === normalize(originalAfter)) throw new ValidationError("O coletor reserva e o coletor substituído devem ser diferentes.");

    const statusIdx = columnIndex(sheet.headers, config.statusColumn);
    const busyInOtherLoan = (coletor: string) =>
      sheet.values.slice(1).some((row, index) => {
        if (index + 2 === record.sheetRow || normalize(row[statusIdx]) !== "aberto") return false;
        return [field(sheet, row, "COLETOR_RESERVA"), field(sheet, row, "COLETOR_SUBSTITUIDO")].some((item) => normalize(item) === normalize(coletor));
      });

    if (changed("COLETOR_RESERVA")) {
      if (busyInOtherLoan(reserveAfter)) throw new ValidationError(`O coletor "${reserveAfter}" já está em outro empréstimo aberto.`, 409);
      const oldReserve = findEquipment(ctx, reserveBefore, field(sheet, before, "SN_RESERVA"), ["E"], "coletor reserva anterior");
      const newReserve = findEquipment(ctx, reserveAfter, "", ["A"], "novo coletor reserva");
      setControl(ctx, oldReserve, "A", "TI-SUPORTE");
      setControl(ctx, newReserve, "E", destination);
      set("SN_RESERVA", serialOf(ctx, newReserve));
      summary += `reserva ${reserveBefore} → ${reserveAfter}; `;
    } else if (changed("SETOR_DESTINO")) {
      const reserve = findEquipment(ctx, reserveBefore, field(sheet, before, "SN_RESERVA"), ["E"], "coletor reserva");
      setControl(ctx, reserve, "E", destination);
    }

    if (changed("COLETOR_SUBSTITUIDO")) {
      if (busyInOtherLoan(originalAfter)) throw new ValidationError(`O coletor "${originalAfter}" já está em outro empréstimo aberto.`, 409);
      const oldOriginal = findEquipment(ctx, originalBefore, field(sheet, before, "SN_SUBSTITUIDO"), ["M"], "coletor substituído anterior");
      const newOriginal = findEquipment(ctx, originalAfter, "", ["A"], "novo coletor substituído");
      setControl(ctx, oldOriginal, "A", destination || field(sheet, before, "SETOR_DESTINO"));
      setControl(ctx, newOriginal, "M", "TI-SUPORTE");
      set("SN_SUBSTITUIDO", serialOf(ctx, newOriginal));
      summary += `substituído ${originalBefore} → ${originalAfter}; `;
    }
  } else {
    const coletorBefore = field(sheet, before, "COLETOR");
    const coletorAfter = field(sheet, after, "COLETOR");
    if (!coletorAfter) throw new ValidationError("Informe o coletor.");
    if (changed("COLETOR")) {
      const previous = field(sheet, before, "LOCALIZACAO_ANTERIOR") || field(sheet, before, "SETOR_ORIGEM");
      const oldEquipment = findEquipment(ctx, coletorBefore, field(sheet, before, "SN"), ["M"], "coletor anterior");
      const newEquipment = findEquipment(ctx, coletorAfter, "", ["A"], "novo coletor");
      setControl(ctx, oldEquipment, "A", previous);
      set("SN", serialOf(ctx, newEquipment));
      set("LOCALIZACAO_ANTERIOR", locationOf(ctx, newEquipment));
      setControl(ctx, newEquipment, "M", "MANUTENÇÃO EXTERNA");
      summary += `coletor ${coletorBefore} → ${coletorAfter}; `;
    }
  }

  after[modifiedIndex] = "SIM";
  const changes: RowChange[] = [{ sheet, sheetRow: record.sheetRow, before, after }, ...ctx.pending.values()];
  return commit(sheets, spreadsheetId, admin, "EDICAO", config.title, `${id}${summary ? ` — ${summary.trim()}` : ""}`, reason, changes);
}

// ---------- Exclusão lógica de processo finalizado ----------

// O registro sai da aba do processo e a exclusão fica registrada somente em tbAuditoriaMobiles,
// com a cópia integral dos dados (DADOS_ANTES). Remoção da linha e auditoria vão numa única
// requisição batchUpdate, que o Google Sheets aplica de forma atômica.
async function deleteFinishedRecord(body: any, admin: string, reason: string) {
  const process = parseProcess(body.process);
  const config = PROCESSES[process];
  const id = text(body.id);
  if (!id) throw new ValidationError("Registro não informado.");

  const sheets = getSheetsClient();
  const spreadsheetId = requireSpreadsheetId();
  const [sheet, audit, meta] = await Promise.all([
    loadSheet(sheets, spreadsheetId, config.sheet),
    loadAudit(sheets, spreadsheetId),
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" }),
  ]);
  const record = findById(sheet!, config.idColumn, id);
  const before = pad(record.row, sheet!.headers.length);

  if (config.statusColumn) {
    const status = normalize(field(sheet!, before, config.statusColumn));
    if (!config.closed.includes(status)) {
      throw new ValidationError("Somente processos finalizados podem ser excluídos. Processos em aberto podem ser modificados.", 409);
    }
  }

  const sheetIdOf = (title: string) => {
    const properties = (meta.data.sheets || []).map((item: any) => item.properties).find((item: any) => item?.title === title);
    if (!properties) throw new ValidationError(`A aba ${title} não existe na planilha.`);
    return properties.sheetId as number;
  };

  const change: RowChange = { sheet: sheet!, sheetRow: record.sheetRow, before, after: before.map(() => "") };
  const entry: Record<string, string> = {
    ID_AUDITORIA: makeId(),
    DATA: now(),
    ADMIN: admin,
    ACAO: "EXCLUSAO",
    PROCESSO: config.title,
    ABA: sheet!.name,
    REGISTRO: id,
    CAMPOS_ALTERADOS: `Registro excluído da aba ${sheet!.name} (linha ${record.sheetRow}).`,
    MOTIVO: reason,
    DADOS_ANTES: snapshot([change], "before"),
    DADOS_DEPOIS: "",
  };
  const auditRow = audit.headers.map((header) => {
    const key = AUDIT_HEADERS.find((name) => normalize(name) === normalize(header));
    return key ? entry[key] : "";
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          appendCells: {
            sheetId: sheetIdOf(AUDIT_SHEET),
            rows: [{ values: auditRow.map((value) => ({ userEnteredValue: { stringValue: value } })) }],
            fields: "userEnteredValue",
          },
        },
        {
          deleteDimension: {
            range: { sheetId: sheetIdOf(sheet!.name), dimension: "ROWS", startIndex: record.sheetRow - 1, endIndex: record.sheetRow },
          },
        },
      ],
    },
  });

  return entry;
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
      const entry = await editOpenRecord(body, admin, reason);
      return res.status(200).json({ success: true, auditId: entry.ID_AUDITORIA });
    }

    if (body.adminAction === "delete") {
      const entry = await deleteFinishedRecord(body, admin, reason);
      return res.status(200).json({ success: true, auditId: entry.ID_AUDITORIA });
    }

    throw new ValidationError("Ação administrativa inválida.");
  } catch (error: any) {
    if (authErrorResponse(error, res)) return;
    if (error instanceof ValidationError) return res.status(error.statusCode).json({ error: error.message });
    console.error("ERRO ADMIN OVERRIDE:", error);
    return res.status(500).json({ error: error?.message || "Erro interno na ação administrativa." });
  }
}
