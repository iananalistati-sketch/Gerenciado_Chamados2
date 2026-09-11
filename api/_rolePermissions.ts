import { DEFAULT_ROLE_PERMISSIONS, isPermissionKey, type PermissionKey, type PermissionMap, type UserRole } from "../shared/permissions.js";
import { getSheetsClient, requireSpreadsheetId } from "./_googleSheets.js";
import { ApiAuthError, requireRole } from "./_requireAuth.js";

export const PERMISSIONS_SHEET = "tbPermissoesPerfis";

const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
const headerIndex = (headers: string[], name: string) => headers.findIndex((header) => normalize(header) === normalize(name));
const enabled = (value: unknown) => ["SIM", "S", "TRUE", "1", "ATIVO"].includes(normalize(value));

export async function loadPermissionMatrix() {
  const matrix = {
    admin: { ...DEFAULT_ROLE_PERMISSIONS.admin },
    analyst: { ...DEFAULT_ROLE_PERMISSIONS.analyst },
    viewer: { ...DEFAULT_ROLE_PERMISSIONS.viewer },
  };
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: requireSpreadsheetId(), range: `${PERMISSIONS_SHEET}!A:E` });
  const values = response.data.values || [];
  if (values.length === 0) throw new Error(`A aba ${PERMISSIONS_SHEET} não possui cabeçalho.`);
  const headers = values[0] || [];
  const roleIdx = headerIndex(headers, "PERFIL");
  const permissionIdx = headerIndex(headers, "PERMISSAO");
  const enabledIdx = headerIndex(headers, "HABILITADA");
  if ([roleIdx, permissionIdx, enabledIdx].some((index) => index === -1)) {
    throw new Error(`A aba ${PERMISSIONS_SHEET} deve possuir PERFIL, PERMISSAO e HABILITADA.`);
  }
  values.slice(1).forEach((row) => {
    const rawRole = String(row[roleIdx] || "").trim().toLowerCase();
    const role = rawRole === "consulta" ? "viewer" : rawRole;
    const permission = row[permissionIdx];
    if ((role === "analyst" || role === "viewer") && isPermissionKey(permission)) matrix[role][permission] = enabled(row[enabledIdx]);
  });
  matrix.admin = { ...DEFAULT_ROLE_PERMISSIONS.admin };
  return { matrix, values, headers, indexes: { roleIdx, permissionIdx, enabledIdx, changedAtIdx: headerIndex(headers, "ALTERADO_EM"), changedByIdx: headerIndex(headers, "ALTERADO_POR") } };
}

export async function requirePermission(authorization: string | string[] | undefined, permission: PermissionKey) {
  const actor = await requireRole(authorization, ["admin", "analyst", "viewer"]);
  if (actor.role === "admin") return actor;
  const { matrix } = await loadPermissionMatrix();
  if (!matrix[actor.role][permission]) throw new ApiAuthError("Usuário sem permissão para esta operação.", 403);
  return actor;
}

