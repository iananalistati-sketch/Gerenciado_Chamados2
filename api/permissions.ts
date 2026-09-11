import type { VercelRequest, VercelResponse } from "@vercel/node";
import { DEFAULT_ROLE_PERMISSIONS, isPermissionKey, PERMISSION_CATALOG, type UserRole } from "../shared/permissions.js";
import { getSheetsClient, requireSpreadsheetId } from "./_googleSheets.js";
import { authErrorResponse, requireRole } from "./_requireAuth.js";
import { loadPermissionMatrix, PERMISSIONS_SHEET } from "./_rolePermissions.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      const actor = await requireRole(req.headers.authorization, ["admin", "analyst", "viewer"]);
      const { matrix } = await loadPermissionMatrix();
      return res.status(200).json({ role: actor.role, permissions: matrix[actor.role], ...(actor.role === "admin" ? { matrix, catalog: PERMISSION_CATALOG } : {}) });
    }
    if (req.method !== "PUT") return res.status(405).json({ error: "Método não permitido." });
    const actor = await requireRole(req.headers.authorization, ["admin"]);
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (updates.length === 0) return res.status(400).json({ error: "Nenhuma permissão informada." });
    const parsed = updates.map((item: any) => {
      const role: UserRole = item.role === "consulta" ? "viewer" : item.role;
      if ((role !== "analyst" && role !== "viewer") || !isPermissionKey(item.permission) || typeof item.enabled !== "boolean") throw new Error("Alteração de permissão inválida.");
      return { role, permission: item.permission, enabled: item.enabled };
    });
    const state = await loadPermissionMatrix();
    const sheets = getSheetsClient();
    const spreadsheetId = requireSpreadsheetId();
    const writes: Array<{ range: string; values: string[][] }> = [];
    const appends: string[][] = [];
    const now = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo", hour12: false }).replace(" ", "T");
    const actorName = String(actor.decodedToken.name || actor.decodedToken.email || actor.decodedToken.uid);
    for (const update of parsed) {
      const rowOffset = state.values.slice(1).findIndex((row) => String(row[state.indexes.roleIdx] || "").trim().toLowerCase().replace("consulta", "viewer") === update.role && row[state.indexes.permissionIdx] === update.permission);
      if (rowOffset >= 0) {
        const rowNumber = rowOffset + 2;
        writes.push({ range: `${PERMISSIONS_SHEET}!${String.fromCharCode(65 + state.indexes.enabledIdx)}${rowNumber}`, values: [[update.enabled ? "SIM" : "NAO"]] });
        if (state.indexes.changedAtIdx >= 0) writes.push({ range: `${PERMISSIONS_SHEET}!${String.fromCharCode(65 + state.indexes.changedAtIdx)}${rowNumber}`, values: [[now]] });
        if (state.indexes.changedByIdx >= 0) writes.push({ range: `${PERMISSIONS_SHEET}!${String.fromCharCode(65 + state.indexes.changedByIdx)}${rowNumber}`, values: [[actorName]] });
      } else {
        const row = new Array(Math.max(state.headers.length, 5)).fill("");
        row[state.indexes.roleIdx] = update.role;
        row[state.indexes.permissionIdx] = update.permission;
        row[state.indexes.enabledIdx] = update.enabled ? "SIM" : "NAO";
        if (state.indexes.changedAtIdx >= 0) row[state.indexes.changedAtIdx] = now;
        if (state.indexes.changedByIdx >= 0) row[state.indexes.changedByIdx] = actorName;
        appends.push(row);
      }
    }
    if (writes.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: writes } });
    if (appends.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: PERMISSIONS_SHEET, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: appends } });
    const next = await loadPermissionMatrix();
    return res.status(200).json({ message: "Permissões atualizadas.", matrix: next.matrix, catalog: PERMISSION_CATALOG });
  } catch (error) {
    if (authErrorResponse(error, res)) return;
    const message = error instanceof Error ? error.message : "Erro interno.";
    return res.status(message.includes("inválida") ? 400 : 500).json({ error: message });
  }
}
