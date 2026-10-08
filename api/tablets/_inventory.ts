import { authErrorResponse } from "../_requireAuth.js";
import { requirePermission } from "../_rolePermissions.js";
import { getSheetsClient, requireSpreadsheetId } from "../_googleSheets.js";

// Cadastro e edição de tablets (tbControleTablets), roteados por /api/create e /api/update.

export const TABLET_CONTROL_SHEET = "tbControleTablets";

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const text = (value: unknown) => String(value || "").trim();

const findHeaderIndex = (headers: string[], ...names: string[]) =>
  headers.findIndex((header) => names.some((name) => normalize(header) === normalize(name)));

class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function handleError(error: any, res: any, context: string) {
  if (authErrorResponse(error, res)) return;
  if (error instanceof ValidationError) return res.status(error.statusCode).json({ error: error.message });
  console.error(`ERRO TABLETS (${context}):`, error);
  return res.status(500).json({ error: error?.message || "Erro interno no controle de tablets." });
}

async function loadControl() {
  const sheets = getSheetsClient();
  const spreadsheetId = requireSpreadsheetId();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TABLET_CONTROL_SHEET}!A:Z` });
  const values = (response.data.values || []) as string[][];
  if (values.length === 0) throw new ValidationError(`A aba ${TABLET_CONTROL_SHEET} não possui cabeçalho.`);
  const headers = values[0];
  const idx = {
    tablet: findHeaderIndex(headers, "Coletor", "Tablet"),
    sn: findHeaderIndex(headers, "SN"),
    setor: findHeaderIndex(headers, "Setor"),
    setorLocalizado: findHeaderIndex(headers, "Setor localizado"),
    status: findHeaderIndex(headers, "Status"),
  };
  if (Object.values(idx).some((value) => value === -1)) {
    throw new ValidationError(`A estrutura de ${TABLET_CONTROL_SHEET} está incompleta (Coletor, SN, Setor, Setor localizado e Status).`);
  }
  return { sheets, spreadsheetId, values, headers, idx };
}

function validateRow(
  row: string[],
  ctx: Awaited<ReturnType<typeof loadControl>>,
  currentSheetRow: number | null
) {
  const { idx, values } = ctx;
  const tablet = text(row[idx.tablet]);
  const sn = text(row[idx.sn]);
  const status = text(row[idx.status]).toUpperCase();

  // SN de tablet é alfanumérico e pode faltar ou se repetir no inventário importado;
  // a tela avisa sobre SN repetido, mas não bloqueia.
  if (!tablet || !text(row[idx.setor]) || !text(row[idx.setorLocalizado]) || !status) {
    throw new ValidationError("Preencha os campos obrigatórios: Tablet, Setor, Setor localizado e Status.");
  }
  if (sn && !/^[A-Za-z0-9-]+$/.test(sn)) throw new ValidationError("SN deve conter apenas letras, números ou hífen.");

  const others = values
    .slice(1)
    .map((other, index) => ({ other, sheetRow: index + 2 }))
    .filter(({ sheetRow }) => sheetRow !== currentSheetRow);

  if (
    status === "A" &&
    others.some(({ other }) => normalize(other[idx.tablet]) === normalize(tablet) && text(other[idx.status]).toUpperCase() === "A")
  ) {
    throw new ValidationError(`Já existe outro tablet ATIVO com a identificação "${tablet}".`, 409);
  }
}

export async function handleTabletCreate(req: any, res: any) {
  try {
    await requirePermission(req.headers.authorization, "tablets.create");
    const { rowData } = req.body || {};
    if (!Array.isArray(rowData)) throw new ValidationError("Dados do registro inválidos.");

    const ctx = await loadControl();
    const row = rowData.slice(0, ctx.headers.length).map((value: unknown) => text(value));
    while (row.length < ctx.headers.length) row.push("");

    const status = text(row[ctx.idx.status]).toUpperCase();
    if (status !== "A" && status !== "I") {
      throw new ValidationError("Um tablet novo deve ser cadastrado como Ativo ou Inativo.");
    }
    row[ctx.idx.status] = status;
    validateRow(row, ctx, null);

    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `${TABLET_CONTROL_SHEET}!A${ctx.values.length + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return handleError(error, res, "cadastro");
  }
}

export async function handleTabletUpdate(req: any, res: any) {
  try {
    await requirePermission(req.headers.authorization, "tablets.edit");
    const { rowIndex, rowData } = req.body || {};
    if (!Number.isInteger(rowIndex) || rowIndex < 2 || !Array.isArray(rowData)) {
      throw new ValidationError("Dados ou índice de linha inválidos.");
    }

    const ctx = await loadControl();
    const current = ctx.values[rowIndex - 1];
    if (!current) throw new ValidationError("Tablet não encontrado na planilha.", 404);

    const row = rowData.slice(0, ctx.headers.length).map((value: unknown) => text(value));
    while (row.length < ctx.headers.length) row.push("");

    const currentStatus = text(current[ctx.idx.status]).toUpperCase();
    const nextStatus = text(row[ctx.idx.status]).toUpperCase();
    row[ctx.idx.status] = nextStatus;

    // Única saída manual de "M": reserva do TI-SUPORTE que volta do reparo interno para o estoque.
    const isReserveBackFromRepair =
      currentStatus === "M" &&
      nextStatus === "A" &&
      normalize(current[ctx.idx.setor]) === normalize("TI-SUPORTE") &&
      normalize(current[ctx.idx.setorLocalizado]) === normalize("MANUTENÇÃO") &&
      normalize(row[ctx.idx.setorLocalizado]) === normalize("TI-SUPORTE");

    if (nextStatus !== currentStatus) {
      if (!isReserveBackFromRepair && (["M", "E"].includes(currentStatus) || ["M", "E"].includes(nextStatus))) {
        throw new ValidationError("Os status Manutenção e Emprestado são controlados automaticamente pela rotina de empréstimo.");
      }
      await requirePermission(req.headers.authorization, "tablets.change_status");
    }

    if (["M", "E"].includes(currentStatus) && !isReserveBackFromRepair) {
      // Durante empréstimo/manutenção a localização é controlada pela rotina de empréstimo.
      row[ctx.idx.setorLocalizado] = text(current[ctx.idx.setorLocalizado]);
    }

    validateRow(row, ctx, rowIndex);

    await ctx.sheets.spreadsheets.values.update({
      spreadsheetId: ctx.spreadsheetId,
      range: `${TABLET_CONTROL_SHEET}!A${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return handleError(error, res, "edição");
  }
}
