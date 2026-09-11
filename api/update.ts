import { google } from "googleapis";
import { authErrorResponse, requireRole, UPDATABLE_SHEETS } from "./_requireAuth.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const { rowIndex, rowData, sheet } = req.body;

    const actor = await requireRole(req.headers.authorization, ["admin", "analyst"]);

    if (typeof sheet !== "string" || !UPDATABLE_SHEETS.has(sheet)) {
      return res.status(400).json({ error: "Aba inválida ou não permitida." });
    }

    if (sheet === "tbConfigMobiles" && actor.role !== "admin") {
      return res.status(403).json({ error: "Somente administradores podem alterar versões alvo." });
    }

    if (!Number.isInteger(rowIndex) || rowIndex < 2 || !Array.isArray(rowData)) {
      return res.status(400).json({ error: "Dados ou índice de linha inválidos." });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY
          ?.replace(/\\n/g, "\n")
          .replace(/^["']|["']$/g, "")
          .trim(),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    if (actor.role !== "admin" && ["tbChamadosMV", "tbChamadosForhealth"].includes(sheet)) {
      const spreadsheetId = process.env.SPREADSHEET_ID;
      const [headerResponse, currentRowResponse] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheet}!1:1` }),
        sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheet}!A${rowIndex}:ZZ${rowIndex}` }),
      ]);
      const normalize = (value: unknown) =>
        String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
      const headers = headerResponse.data.values?.[0] || [];
      const currentRow = currentRowResponse.data.values?.[0] || [];
      const deletedIndex = headers.findIndex((header) => normalize(header) === "excluido");

      if (
        deletedIndex !== -1 &&
        normalize(rowData[deletedIndex]) === "sim" &&
        normalize(currentRow[deletedIndex]) !== "sim"
      ) {
        return res.status(403).json({ error: "Somente administradores podem excluir chamados." });
      }
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: `${sheet}!A${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowData],
      },
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    if (authErrorResponse(error, res)) return;
    console.error("ERRO UPDATE:", error);
    res.status(500).json({ error: error.message });
  }
}
