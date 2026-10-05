import { authErrorResponse } from "../_requireAuth.js";
import { requirePermission } from "../_rolePermissions.js";
import { getSheetsClient, requireSpreadsheetId } from "../_googleSheets.js";

// Fluxo de manutenção externa SEM equipamento reserva.
// Usa os endpoints /api/mobiles/loan (envio) e /api/mobiles/loan-return (retorno)
// para não ultrapassar o limite de funções serverless do plano da Vercel.

const CONTROL_SHEET = "tbControleMobiles";
export const EXTERNAL_MAINTENANCE_SHEET = "tbManutencaoExternaMobiles";
export const EXTERNAL_MAINTENANCE_LOCATION = "MANUTENÇÃO EXTERNA";

export const EXTERNAL_MAINTENANCE_HEADERS = [
  "ID_MANUTENCAO",
  "STATUS_MANUTENCAO",
  "COLETOR",
  "SN",
  "MARCA",
  "MODELO",
  "SETOR_ORIGEM",
  "LOCALIZACAO_ANTERIOR",
  "DATA_ENVIO",
  "RESPONSAVEL_RECEBIMENTO",
  "COLABORADOR_ENTREGA_NOME",
  "COLABORADOR_ENTREGA_MATRICULA",
  "COLABORADOR_ENTREGA_CARGO",
  "ORDEM_SERVICO",
  "DEFEITO_RELATADO",
  "ACESSORIOS_ENTREGUES",
  "OBS_ENVIO",
  "DATA_RETORNO",
  "RESPONSAVEL_RETORNO",
  "COLABORADOR_RETORNO_NOME",
  "COLABORADOR_RETORNO_MATRICULA",
  "COLABORADOR_RETORNO_CARGO",
  "SETOR_RETORNO",
  "SERVICO_REALIZADO",
  "OBS_RETORNO",
];

const ALLOWED_ACCESSORIES = new Set(["BATERIA", "CARREGADOR_BASE", "ALCA_CAPA", "CABO_USB"]);

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const text = (value: unknown) => String(value || "").trim();

const findHeaderIndex = (headers: string[], ...names: string[]) =>
  headers.findIndex((header) => names.some((name) => normalize(header) === normalize(name)));

const toLocalIsoDateTime = () =>
  new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo", hour12: false })
    .replace(" ", "T");

const makeMaintenanceId = () => {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MEX${stamp}${suffix}`;
};

class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const padRow = (row: string[], length: number) => {
  const copy = [...row];
  while (copy.length < length) copy.push("");
  return copy;
};

async function loadSheets() {
  const sheets = getSheetsClient();
  const spreadsheetId = requireSpreadsheetId();

  const [controlResponse, maintenanceResponse] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${CONTROL_SHEET}!A:Z` }),
    sheets.spreadsheets.values
      .get({ spreadsheetId, range: `${EXTERNAL_MAINTENANCE_SHEET}!A:Z` })
      .catch((error: any) => {
        // A API do Google responde "Unable to parse range" quando a aba não existe.
        if (/parse range/i.test(String(error?.message || ""))) return null;
        throw error;
      }),
  ]);

  if (!maintenanceResponse) {
    throw new ValidationError(
      `A aba ${EXTERNAL_MAINTENANCE_SHEET} não existe na planilha. Crie a aba com os cabeçalhos: ${EXTERNAL_MAINTENANCE_HEADERS.join(", ")}.`
    );
  }
  const maintenanceValues = (maintenanceResponse.data.values || []) as string[][];

  const controlValues = (controlResponse.data.values || []) as string[][];
  if (controlValues.length === 0) throw new ValidationError(`A aba ${CONTROL_SHEET} não possui cabeçalho.`);

  const maintenanceHeaders = maintenanceValues[0] || [];
  const missing = EXTERNAL_MAINTENANCE_HEADERS.filter((header) => findHeaderIndex(maintenanceHeaders, header) === -1);
  if (missing.length > 0) {
    throw new ValidationError(`A aba ${EXTERNAL_MAINTENANCE_SHEET} não possui as colunas: ${missing.join(", ")}.`);
  }

  const controlHeaders = controlValues[0] || [];
  const idx = {
    coletor: findHeaderIndex(controlHeaders, "Coletor"),
    sn: findHeaderIndex(controlHeaders, "SN"),
    setor: findHeaderIndex(controlHeaders, "Setor"),
    setorLocalizado: findHeaderIndex(controlHeaders, "Setor localizado"),
    status: findHeaderIndex(controlHeaders, "Status"),
  };
  if (Object.values(idx).some((value) => value === -1)) {
    throw new ValidationError(`A estrutura de ${CONTROL_SHEET} está incompatível com a manutenção externa.`);
  }

  const mIdx = (name: string) => findHeaderIndex(maintenanceHeaders, name);

  return { sheets, spreadsheetId, controlValues, controlHeaders, idx, maintenanceValues, maintenanceHeaders, mIdx };
}

const valueOf = (headers: string[], row: string[], name: string) => {
  const index = findHeaderIndex(headers, name);
  return index === -1 ? "" : text(row[index]);
};

export const maintenanceRowToTermData = (headers: string[], row: string[]) =>
  Object.fromEntries(EXTERNAL_MAINTENANCE_HEADERS.map((header) => [header, valueOf(headers, row, header)]));

function handleError(error: any, res: any, context: string) {
  if (authErrorResponse(error, res)) return;
  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error(`ERRO MANUTENCAO EXTERNA (${context}):`, error);
  return res.status(500).json({ error: error?.message || "Erro interno na manutenção externa." });
}

export async function handleExternalMaintenanceSend(req: any, res: any) {
  try {
    const { decodedToken } = await requirePermission(req.headers.authorization, "maintenance.manage");
    const body = req.body || {};
    const collector = text(body.collector);
    const serial = text(body.serial);
    const responsible = text(decodedToken.name || decodedToken.email);
    const accessories: string[] = Array.isArray(body.accessories)
      ? body.accessories.map((item: unknown) => text(item).toUpperCase()).filter(Boolean)
      : [];
    const otherAccessories = text(body.otherAccessories);

    if (!collector) throw new ValidationError("Coletor não informado.");
    if (!responsible) throw new ValidationError("Responsável pelo recebimento não identificado.");
    if (!text(body.deliveryName) || !text(body.deliveryRegistration) || !text(body.deliveryRole)) {
      throw new ValidationError("Nome, matrícula e cargo de quem entregou o equipamento são obrigatórios.");
    }
    if (!text(body.brand) || !text(body.model)) throw new ValidationError("Marca e modelo do equipamento são obrigatórios.");
    if (!text(body.reportedDefect)) throw new ValidationError("Descreva o defeito relatado.");
    if (accessories.some((item) => !ALLOWED_ACCESSORIES.has(item))) throw new ValidationError("Acessório inválido informado.");

    const ctx = await loadSheets();
    const { idx } = ctx;

    const matches = ctx.controlValues
      .slice(1)
      .map((row, index) => ({ row, sheetRow: index + 2 }))
      .filter(({ row }) =>
        normalize(row[idx.coletor]) === normalize(collector) &&
        text(row[idx.status]).toUpperCase() === "A" &&
        (!serial || normalize(row[idx.sn]) === normalize(serial))
      );

    if (matches.length !== 1) {
      throw new ValidationError(
        matches.length === 0
          ? `Não foi encontrado equipamento ATIVO para o Coletor "${collector}". Somente equipamentos ativos podem ser enviados para manutenção externa.`
          : `Existe mais de um equipamento ATIVO para o Coletor "${collector}". Corrija o cadastro antes de prosseguir.`,
        409
      );
    }

    const statusIdx = ctx.mIdx("STATUS_MANUTENCAO");
    const collectorIdx = ctx.mIdx("COLETOR");
    const hasOpen = ctx.maintenanceValues
      .slice(1)
      .some((row) => normalize(row[statusIdx]) === "aberta" && normalize(row[collectorIdx]) === normalize(collector));
    if (hasOpen) {
      throw new ValidationError(`Já existe uma manutenção externa ABERTA para o Coletor "${collector}".`, 409);
    }

    const equipment = matches[0];
    const controlUpdated = padRow(equipment.row, ctx.controlHeaders.length);
    const previousLocation = text(equipment.row[idx.setorLocalizado]);
    controlUpdated[idx.status] = "M";
    controlUpdated[idx.setorLocalizado] = EXTERNAL_MAINTENANCE_LOCATION;

    const accessoryList = [...accessories, ...(otherAccessories ? [`OUTROS: ${otherAccessories}`] : [])];
    const record: Record<string, string> = {
      ID_MANUTENCAO: makeMaintenanceId(),
      STATUS_MANUTENCAO: "ABERTA",
      COLETOR: text(equipment.row[idx.coletor]),
      SN: text(equipment.row[idx.sn]),
      MARCA: text(body.brand),
      MODELO: text(body.model),
      SETOR_ORIGEM: text(equipment.row[idx.setor]),
      LOCALIZACAO_ANTERIOR: previousLocation,
      DATA_ENVIO: toLocalIsoDateTime(),
      RESPONSAVEL_RECEBIMENTO: responsible,
      COLABORADOR_ENTREGA_NOME: text(body.deliveryName),
      COLABORADOR_ENTREGA_MATRICULA: text(body.deliveryRegistration),
      COLABORADOR_ENTREGA_CARGO: text(body.deliveryRole),
      ORDEM_SERVICO: text(body.serviceOrder),
      DEFEITO_RELATADO: text(body.reportedDefect),
      ACESSORIOS_ENTREGUES: accessoryList.join(" | "),
      OBS_ENVIO: text(body.observation),
    };

    const maintenanceRow = ctx.maintenanceHeaders.map((header) => {
      const key = EXTERNAL_MAINTENANCE_HEADERS.find((name) => normalize(name) === normalize(header));
      return key ? record[key] || "" : "";
    });

    const nextMaintenanceRow = ctx.maintenanceValues.length + 1;

    await ctx.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ctx.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${CONTROL_SHEET}!A${equipment.sheetRow}`, values: [controlUpdated] },
          { range: `${EXTERNAL_MAINTENANCE_SHEET}!A${nextMaintenanceRow}`, values: [maintenanceRow] },
        ],
      },
    });

    return res.status(200).json({
      success: true,
      maintenanceId: record.ID_MANUTENCAO,
      termData: maintenanceRowToTermData(EXTERNAL_MAINTENANCE_HEADERS, EXTERNAL_MAINTENANCE_HEADERS.map((h) => record[h] || "")),
    });
  } catch (error) {
    return handleError(error, res, "envio");
  }
}

export async function handleExternalMaintenanceReturn(req: any, res: any) {
  try {
    const { decodedToken } = await requirePermission(req.headers.authorization, "maintenance.manage");
    const body = req.body || {};
    const maintenanceId = text(body.maintenanceId);
    const responsible = text(decodedToken.name || decodedToken.email);
    const returnSector = text(body.returnSector);

    if (!maintenanceId) throw new ValidationError("Manutenção externa não informada.");
    if (!responsible) throw new ValidationError("Responsável pelo retorno não identificado.");
    if (!text(body.receiverName) || !text(body.receiverRegistration) || !text(body.receiverRole)) {
      throw new ValidationError("Nome, matrícula e cargo de quem recebeu o equipamento são obrigatórios.");
    }
    if (!returnSector) throw new ValidationError("Informe o setor que receberá o equipamento.");

    const ctx = await loadSheets();
    const { idx } = ctx;

    const idIdx = ctx.mIdx("ID_MANUTENCAO");
    const records = ctx.maintenanceValues
      .slice(1)
      .map((row, index) => ({ row, sheetRow: index + 2 }))
      .filter(({ row }) => normalize(row[idIdx]) === normalize(maintenanceId));

    if (records.length !== 1) {
      throw new ValidationError(
        records.length === 0
          ? `Manutenção externa "${maintenanceId}" não encontrada.`
          : `Existe mais de um registro para a manutenção externa "${maintenanceId}".`,
        409
      );
    }

    const record = records[0];
    const headers = ctx.maintenanceHeaders;
    if (normalize(valueOf(headers, record.row, "STATUS_MANUTENCAO")) !== "aberta") {
      throw new ValidationError("Esta manutenção externa já foi finalizada.", 409);
    }

    const collector = valueOf(headers, record.row, "COLETOR");
    const serial = valueOf(headers, record.row, "SN");

    const controlMatches = ctx.controlValues
      .slice(1)
      .map((row, index) => ({ row, sheetRow: index + 2 }))
      .filter(({ row }) =>
        normalize(row[idx.coletor]) === normalize(collector) &&
        (!serial || normalize(row[idx.sn]) === normalize(serial)) &&
        text(row[idx.status]).toUpperCase() === "M"
      );

    if (controlMatches.length !== 1) {
      throw new ValidationError(
        `Não foi encontrado exatamente um equipamento em Manutenção para o Coletor "${collector}"${serial ? ` (SN ${serial})` : ""}.`,
        409
      );
    }

    const activeConflict = ctx.controlValues
      .slice(1)
      .some((row) => normalize(row[idx.coletor]) === normalize(collector) && text(row[idx.status]).toUpperCase() === "A");
    if (activeConflict) {
      throw new ValidationError(`Já existe outro equipamento ATIVO com o Coletor "${collector}". Corrija o cadastro antes de registrar o retorno.`, 409);
    }

    const equipment = controlMatches[0];
    const controlUpdated = padRow(equipment.row, ctx.controlHeaders.length);
    controlUpdated[idx.status] = "A";
    controlUpdated[idx.setorLocalizado] = returnSector;

    const recordUpdated = padRow(record.row, headers.length);
    const setField = (name: string, value: string) => {
      const index = findHeaderIndex(headers, name);
      if (index !== -1) recordUpdated[index] = value;
    };
    setField("STATUS_MANUTENCAO", "FINALIZADA");
    setField("DATA_RETORNO", toLocalIsoDateTime());
    setField("RESPONSAVEL_RETORNO", responsible);
    setField("COLABORADOR_RETORNO_NOME", text(body.receiverName));
    setField("COLABORADOR_RETORNO_MATRICULA", text(body.receiverRegistration));
    setField("COLABORADOR_RETORNO_CARGO", text(body.receiverRole));
    setField("SETOR_RETORNO", returnSector);
    setField("SERVICO_REALIZADO", text(body.serviceDone));
    setField("OBS_RETORNO", text(body.observation));

    await ctx.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ctx.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${CONTROL_SHEET}!A${equipment.sheetRow}`, values: [controlUpdated] },
          { range: `${EXTERNAL_MAINTENANCE_SHEET}!A${record.sheetRow}`, values: [recordUpdated] },
        ],
      },
    });

    return res.status(200).json({
      success: true,
      maintenanceId,
      termData: maintenanceRowToTermData(headers, recordUpdated),
    });
  } catch (error) {
    return handleError(error, res, "retorno");
  }
}
