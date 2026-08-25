import {
  getAdminAuth,
} from "./_firebaseAdmin";

export async function requireAdmin(
  authorizationHeader?: string
) {
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