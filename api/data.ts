import { google } from "googleapis";
import { authErrorResponse, READABLE_SHEETS, requireRole } from "./_requireAuth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const { sheet } = req.query;

    await requireRole(req.headers.authorization, ["admin", "analyst", "viewer"]);

    if (typeof sheet !== "string" || !READABLE_SHEETS.has(sheet)) {
      return res.status(400).json({ error: "Aba inválida ou não permitida." });
    }

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

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

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: sheet,
    });

    const values = response.data.values || [];

    res.status(200).json(values);
  } catch (error) {
    if (authErrorResponse(error, res)) return;
    console.error(error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erro interno." });
  }
}
