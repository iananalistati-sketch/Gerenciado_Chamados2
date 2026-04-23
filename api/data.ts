import { google } from "googleapis";

export default async function handler(req: any, res: any) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheet = req.query.sheet || "tbChamadosMV";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: sheet,
    });

    res.status(200).json(response.data.values);
  } catch (error: any) {
    console.error("ERRO API:", error);
    res.status(500).json({ error: error.message });
  }
}
