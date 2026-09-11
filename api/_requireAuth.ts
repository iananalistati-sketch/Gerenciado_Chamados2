import { getAdminAuth } from "./_firebaseAdmin.js";

export type AppRole = "admin" | "analyst" | "viewer";

export class ApiAuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiAuthError";
    this.statusCode = statusCode;
  }
}

export const READABLE_SHEETS = new Set([
  "tbChamadosMV",
  "tbChamadosForhealth",
  "tbControleMobiles",
  "tbConfigMobiles",
  "tbMobileApps",
  "tbEmprestimosMobiles",
]);

export const CREATABLE_SHEETS = new Set([
  "tbChamadosMV",
  "tbChamadosForhealth",
  "tbControleMobiles",
  "tbConfigMobiles",
]);

export const UPDATABLE_SHEETS = new Set([
  "tbChamadosMV",
  "tbChamadosForhealth",
  "tbControleMobiles",
  "tbConfigMobiles",
  "tbMobileApps",
]);

export async function requireRole(
  authorizationHeader: string | string[] | undefined,
  allowedRoles: AppRole[]
) {
  const header = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;

  if (!header?.startsWith("Bearer ")) {
    throw new ApiAuthError("Token de autenticação não informado.", 401);
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(header.substring(7));
    const claimedRole = decodedToken.role;
    const role: AppRole =
      claimedRole === "admin" || claimedRole === "analyst" || claimedRole === "viewer"
        ? claimedRole
        : "viewer";

    if (!allowedRoles.includes(role)) {
      throw new ApiAuthError("Usuário sem permissão para esta operação.", 403);
    }

    return { decodedToken, role };
  } catch (error) {
    if (error instanceof ApiAuthError) {
      throw error;
    }

    throw new ApiAuthError("Token de autenticação inválido ou expirado.", 401);
  }
}

export function authErrorResponse(error: unknown, res: any) {
  if (!(error instanceof ApiAuthError)) {
    return false;
  }

  res.status(error.statusCode).json({ error: error.message });
  return true;
}
