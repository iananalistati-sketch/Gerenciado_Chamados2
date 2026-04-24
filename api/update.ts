import { google } from "googleapis";

console.log("BODY RECEBIDO:", req.body);

export default async function handler(req: any, res: any) {
  try {
    const { rowIndex, data, sheet, sheetName } = req.body;

    const finalSheet = sheet || sheetName;
    
    if (!finalSheet) {
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
      range: `${finalSheet}!A${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [data],
      },
    });

    console.log("SHEET FINAL:", finalSheet);

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("ERRO UPDATE:", error);
    res.status(500).json({ error: error.message });
  }
}
