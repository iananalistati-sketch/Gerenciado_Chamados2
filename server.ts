import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import open from "open";

dotenv.config();

/**
 * server.ts
 * Backend para integração com Google Sheets API via Service Account.
 * Não utiliza OAuth para o usuário final, permitindo acesso direto do servidor.
 */

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ID da planilha vindo das variáveis de ambiente ou fallback padrão
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1f0675YhzxnUWDQ4bevIFVNnWs5Z1NTQ1DmCajLwFcQM";

if (!process.env.SPREADSHEET_ID) {
  console.log("INFO: Usando SPREADSHEET_ID padrão (fallback).");
}

// Helper para normalizar cabeçalhos (remove acentos, espaços e padroniza caixa)
const normalize = (str: string) => 
  (str || "")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

// Helper para converter índice numérico (0) em letra de coluna (A)
const getColumnLetter = (index: number): string => {
  let letter = "";
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
};

async function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("Configurações de Google Service Account (email/key) ausentes no .env");
  }

  const auth = new google.auth.JWT({
    email: email,
    key: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth;
}

// API: Ler dados da planilha
app.get("/api/data", async (req, res) => {
  const sheetName = (req.query.sheet as string) || process.env.SHEET_NAME || "tbChamadosMV";
  const range = req.query.range as string || `${sheetName}!A:Z`;
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    res.json({ values: response.data.values || [] });
  } catch (error: any) {
    console.error("Erro ao ler planilha:", error);
    res.status(500).json({ 
      error: "Falha ao ler dados.",
      details: error.message 
    });
  }
});

// API: Inserir novos dados
app.post("/api/data", async (req, res) => {
  const { rowData } = req.body; 
  const sheetName = (req.query.sheet as string) || (req.body.sheet as string) || process.env.SHEET_NAME || "tbChamadosMV";
  const range = req.body.range || `${sheetName}!A:A`;

  if (!rowData || !Array.isArray(rowData)) {
    return res.status(400).json({ error: "Dados da linha inválidos ou ausentes." });
  }

  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowData],
      },
    });

    res.json({ success: true, message: "Dados inseridos com sucesso." });
  } catch (error: any) {
    console.error("Erro ao inserir na planilha:", error);
    res.status(500).json({ 
      error: "Falha ao inserir dados.",
      details: error.message 
    });
  }
});

// API: Atualizar dados existentes
app.put("/api/data", async (req, res) => {
  const { rowData, rowIndex, sheetName, column, value } = req.body;
  const targetSheet = sheetName || process.env.SHEET_NAME || "tbChamadosMV";
  
  if (rowIndex === undefined) {
    return res.status(400).json({ error: "Índice da linha ausente." });
  }

  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    
    let range = `${targetSheet}!A${rowIndex}:Z${rowIndex}`;
    let values = [rowData];

    // Se for uma atualização de coluna única (ex: Exclusão Lógica)
    if (column && value !== undefined) {
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${targetSheet}!1:1`,
      });

      const headers = headerResponse.data.values?.[0] || [];
      const colIdx = headers.findIndex(h => normalize(h) === normalize(column));

      if (colIdx === -1) {
        return res.status(400).json({ error: `Coluna "${column}" não encontrada.` });
      }

      const colLetter = getColumnLetter(colIdx);
      range = `${targetSheet}!${colLetter}${rowIndex}`;
      values = [[value]];
    } else if (!rowData || !Array.isArray(rowData)) {
      return res.status(400).json({ error: "Dados da linha ausentes para atualização completa." });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: values,
      },
    });

    res.json({ success: true, message: "Dados atualizados com sucesso." });
  } catch (error: any) {
    console.error("Erro ao atualizar na planilha:", error);
    res.status(500).json({ 
      error: "Falha ao atualizar dados.",
      details: error.message 
    });
  }
});

// Configuração do Vite Middleware para servir o Frontend
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== "production") {
      open(`http://localhost:${PORT}`);
    }
  });
});
