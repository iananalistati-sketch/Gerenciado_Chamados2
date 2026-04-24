import { google } from "googleapis";

export default async function handler(req: any, res: any) {
  // 🔒 Permitir apenas PUT
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    console.log("BODY RECEBIDO:", req.body);

    const { rowIndex, data, sheet } = req.body;

    // 🚨 VALIDAÇÃO FORTE (aqui está seu erro atual)
    if (!sheet) {
      return res.status(400).json({ error: "Sheet não informada" });
    }

    if (!rowIndex) {
      return res.status(400).json({ error: "rowIndex não informado" });
    }

    if (!data) {
      return res.status(400).json({ error: "data não informado" });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: `${sheet}!A${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [data],
      },
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("ERRO UPDATE:", error);
    return res.status(500).json({ error: error.message });
  }
}
