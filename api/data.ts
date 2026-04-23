import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    
    const sheets = google.sheets({
      version: "v4",
      auth: await auth.getClient(),
    });

    const spreadsheetId = process.env.SPREADSHEET_ID;

    // =========================
    // 🔍 GET - BUSCAR DADOS
    // =========================
    if (req.method === "GET") {
      const { sheet } = req.query;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheet,
      });

      return res.status(200).json(response.data.values || []);
    }

    // =========================
    // ✏️ PUT - ATUALIZAR LINHA
    // =========================
    if (req.method === "PUT") {
      const { rowIndex, data, sheetName } = req.body;

      if (!rowIndex || !data || !sheetName) {
        return res.status(400).json({ error: "Dados incompletos" });
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [data], // 🔥 já é array
        },
      });

      return res.status(200).json({ success: true });
    }

    // =========================
    // ➕ POST - INSERIR NOVA LINHA
    // =========================
    if (req.method === "POST") {
      const { data, sheetName } = req.body;

      if (!data || !sheetName) {
        return res.status(400).json({ error: "Dados incompletos" });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [data],
        },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (error) {
    console.error("ERRO API:", error);
    return res.status(500).json({
      error: error.message,
    });
  }
}
