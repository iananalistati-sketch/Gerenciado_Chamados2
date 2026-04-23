import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const { sheet } = req.query;

    if (!sheet) {
      return res.status(400).json({ error: "Sheet não informada" });
    }

    // ✅ MESMO PADRÃO DO UPDATE (GoogleAuth)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const client = await auth.getClient();

    const sheets = google.sheets({
      version: "v4",
      auth: client,
    });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: sheet,
    });

    const values = response.data.values || [];

    // ✅ RETORNA DIRETO ARRAY (igual antes)
    res.status(200).json(values);

  } catch (error) {
    console.error("Erro API data:", error);
    res.status(500).json({ error: error.message });
  }
}
