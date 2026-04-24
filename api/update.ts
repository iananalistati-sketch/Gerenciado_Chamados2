import { google } from "googleapis";

export default async function handler(req: any, res: any) {
  try {
    const { rowIndex, rowData, sheet } = req.body;

    console.log("BODY RECEBIDO:", req.body);

    if (!sheet) {
      return res.status(400).json({ error: "Sheet não informada" });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

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
    console.error("ERRO UPDATE:", error);
    res.status(500).json({ error: error.message });
  }
}
