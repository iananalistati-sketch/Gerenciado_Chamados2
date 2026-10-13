import { AsyncLocalStorage } from "node:async_hooks";
import { google } from "googleapis";

export function getSheetsClient() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")
    .replace(/^["']|["']$/g, "")
    .trim();
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// Base de dados escolhida no login: "producao" (SPREADSHEET_ID) ou "treinamento"
// (SPREADSHEET_ID_TREINAMENTO). O frontend envia o cabeçalho X-Base-Dados em cada requisição.
export type DataBase = "producao" | "treinamento";
const dataBaseContext = new AsyncLocalStorage<DataBase>();

export const DATA_BASE_HEADER = "x-base-dados";

export function dataBaseFromRequest(req: any): DataBase {
  const raw = req?.headers?.[DATA_BASE_HEADER];
  const value = String(Array.isArray(raw) ? raw[0] : raw || "").trim().toLowerCase();
  return value === "treinamento" ? "treinamento" : "producao";
}

// Envolve um handler para que todas as leituras/gravações usem a base da requisição.
export function withDataBase<T extends (req: any, res: any) => any>(handler: T) {
  return (req: any, res: any) => dataBaseContext.run(dataBaseFromRequest(req), () => handler(req, res));
}

export function currentDataBase(): DataBase {
  return dataBaseContext.getStore() || "producao";
}

// production: true força a planilha de produção (ex.: matriz de permissões, que é única).
export function requireSpreadsheetId(options: { production?: boolean } = {}) {
  if (!options.production && currentDataBase() === "treinamento") {
    const trainingId = process.env.SPREADSHEET_ID_TREINAMENTO;
    if (!trainingId) throw new Error("A base de treinamento não está configurada (SPREADSHEET_ID_TREINAMENTO).");
    return trainingId;
  }
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID não configurado.");
  return spreadsheetId;
}
