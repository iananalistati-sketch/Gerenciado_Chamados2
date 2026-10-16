import { getSheetsClient, requireSpreadsheetId } from "../_googleSheets.js";
import { authErrorResponse } from "../_requireAuth.js";
import { requireAnyPermission } from "../_rolePermissions.js";

// Registro do número da RNC (Registro de Não Conformidade) em empréstimos de coletores/tablets e em
// manutenções externas de coletores. Só pode ser preenchido/alterado enquanto o processo está em
// aberto, por quem gerencia aquele processo. Roteado por /api/mobiles/loan (flow=rnc) para não
// exceder o limite de funções.

export const RNC_COLUMN = "NUMERO_RNC";
const MAX_LENGTH = 60;

type PermissionList = Parameters<typeof requireAnyPermission>[1];

const TARGETS: Record<"mobile" | "tablet" | "external", { sheet: string; idColumn: string; statusColumn: string; openStatus: string; label: string; permissions: PermissionList }> = {
  mobile: { sheet: "tbEmprestimosMobiles", idColumn: "ID_EMPRESTIMO", statusColumn: "STATUS_EMPRESTIMO", openStatus: "aberto", label: "o empréstimo", permissions: ["loans.create", "loans.return"] },
  tablet: { sheet: "tbEmprestimosTablets", idColumn: "ID_EMPRESTIMO", statusColumn: "STATUS_EMPRESTIMO", openStatus: "aberto", label: "o empréstimo", permissions: ["tablet_loans.create", "tablet_loans.return"] },
  external: { sheet: "tbManutencaoExternaMobiles", idColumn: "ID_MANUTENCAO", statusColumn: "STATUS_MANUTENCAO", openStatus: "aberta", label: "a manutenção externa", permissions: ["maintenance.manage"] },
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const text = (value: unknown) => String(value ?? "").trim();

const columnLetter = (index: number) => {
  let letter = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  return letter;
};

class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function handleLoanRnc(req: any, res: any) {
  try {
    const body = req.body || {};
    const target = body.process === "external" ? "external" : body.device === "tablet" ? "tablet" : "mobile";
    const config = TARGETS[target];
    await requireAnyPermission(req.headers.authorization, config.permissions);

    const loanId = text(body.process === "external" ? body.maintenanceId : body.loanId);
    const rnc = text(body.rnc);
    if (!loanId) throw new ValidationError("Registro não informado.");
    if (rnc.length > MAX_LENGTH) throw new ValidationError(`O número da RNC deve ter no máximo ${MAX_LENGTH} caracteres.`);

    const sheets = getSheetsClient();
    const spreadsheetId = requireSpreadsheetId();
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${config.sheet}!A:AZ` });
    const values = ((response.data.values || []) as string[][]).map((row) => row.map((value) => String(value ?? "")));
    const headers = values[0] || [];
    const idIdx = headers.findIndex((header) => normalize(header) === normalize(config.idColumn));
    const statusIdx = headers.findIndex((header) => normalize(header) === normalize(config.statusColumn));
    if (idIdx === -1 || statusIdx === -1) throw new ValidationError(`A aba ${config.sheet} não possui ${config.idColumn} e ${config.statusColumn}.`);

    const matches = values
      .slice(1)
      .map((row, index) => ({ row, sheetRow: index + 2 }))
      .filter(({ row }) => normalize(row[idIdx]) === normalize(loanId));
    if (matches.length !== 1) throw new ValidationError(`Registro "${loanId}" não encontrado.`, 404);
    const loan = matches[0];
    if (normalize(loan.row[statusIdx]) !== config.openStatus) {
      throw new ValidationError(`A RNC só pode ser registrada enquanto ${config.label} está em aberto.`, 409);
    }

    // Cria a coluna NUMERO_RNC no fim do cabeçalho na primeira utilização (produção e treinamento).
    let rncIdx = headers.findIndex((header) => normalize(header) === normalize(RNC_COLUMN));
    const writes: { range: string; values: string[][] }[] = [];
    if (rncIdx === -1) {
      rncIdx = headers.length;
      const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.columnCount)" });
      const properties = (meta.data.sheets || []).map((item: any) => item.properties).find((item: any) => item?.title === config.sheet);
      if (!properties) throw new ValidationError(`A aba ${config.sheet} não existe na planilha.`);
      const columnCount = properties.gridProperties?.columnCount || 0;
      if (columnCount <= rncIdx) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ appendDimension: { sheetId: properties.sheetId, dimension: "COLUMNS", length: rncIdx + 1 - columnCount } }] },
        });
      }
      writes.push({ range: `${config.sheet}!${columnLetter(rncIdx)}1`, values: [[RNC_COLUMN]] });
    }

    writes.push({ range: `${config.sheet}!${columnLetter(rncIdx)}${loan.sheetRow}`, values: [[rnc]] });
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: writes } });

    return res.status(200).json({ success: true, id: loanId, rnc });
  } catch (error: any) {
    if (authErrorResponse(error, res)) return;
    if (error instanceof ValidationError) return res.status(error.statusCode).json({ error: error.message });
    console.error("ERRO RNC EMPRESTIMO:", error);
    return res.status(500).json({ error: error?.message || "Erro ao registrar a RNC." });
  }
}
