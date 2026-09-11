import type { PermissionKey } from "../shared/permissions.js";
import { getAdminAuth } from "./_firebaseAdmin.js";
import { requirePermission } from "./_rolePermissions.js";

export async function requireAdmin(
  authorizationHeader?: string,
  permission?: PermissionKey
) {
  if (permission) {
    const actor = await requirePermission(authorizationHeader, permission);
    return actor.decodedToken;
  }
  if (
    !authorizationHeader ||
    !authorizationHeader.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "Token de autenticação não informado."
    );
  }

  const token =
    authorizationHeader.substring(7);

  const adminAuth =
    getAdminAuth();

  const decodedToken =
    await adminAuth.verifyIdToken(token);

  if (decodedToken.role !== "admin") {
    throw new Error(
      "Usuário sem permissão administrativa."
    );
  }

  return decodedToken;
}
