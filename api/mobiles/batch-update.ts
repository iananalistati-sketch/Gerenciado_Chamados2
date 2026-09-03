import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";

const SHEET_NAME = "tbControleMobiles";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({
      error: "Método não permitido.",
    });
  }

  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        error: "Updates inválidos.",
      });
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "Nenhum equipamento informado.",
      });
    }

    for (const update of updates) {
      if (
        typeof update.rowIndex !== "number" ||
        !Array.isArray(update.rowData)
      ) {
        return res.status(400).json({
          error:
            "Estrutura de atualização inválida.",
        });
      }

      if (update.rowIndex < 2) {
        return res.status(400).json({
          error:
            "Índice de linha inválido.",
        });
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email:
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,

        private_key:
          process.env.GOOGLE_PRIVATE_KEY
            ?.replace(/\\n/g, "\n")
            .replace(/^["']|["']$/g, "")
            .trim(),
      },

      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    const data = updates.map(
      (update: {
        rowIndex: number;
        rowData: string[];
      }) => ({
        range: `${SHEET_NAME}!A${update.rowIndex}`,
        values: [update.rowData],
      })
    );

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId:
        process.env.SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data,
      },
    });

    return res.status(200).json({
      success: true,
      updated: updates.length,
    });
  } catch (error: any) {
    console.error(
      "Erro na atualização em lote:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Erro interno ao atualizar equipamentos.",
    });
  }
}