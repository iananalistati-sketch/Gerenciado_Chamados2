import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

import {
  getAdminAuth,
} from "../_firebaseAdmin.js";

import {
  requireAdmin,
} from "../_requireAdmin.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Método não permitido.",
    });
  }

  try {
    const adminAuth = getAdminAuth();

    await requireAdmin(
      req.headers.authorization
    );

    const result =
      await adminAuth.listUsers(1000);

    const users = result.users.map(
      user => ({
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        disabled: user.disabled,
        role:
          user.customClaims?.role ||
          "viewer",
        createdAt:
          user.metadata.creationTime,
        lastLoginAt:
          user.metadata.lastSignInTime,
      })
    );

    users.sort((a, b) =>
      a.email.localeCompare(
        b.email,
        "pt-BR",
        {
          sensitivity: "base",
        }
      )
    );

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error: any) {
    console.error(
      "Erro ao listar usuários:",
      error
    );

    if (
      error?.message ===
      "Usuário sem permissão administrativa."
    ) {
      return res.status(403).json({
        error: error.message,
      });
    }

    if (
      error?.message ===
      "Token de autenticação não informado."
    ) {
      return res.status(401).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error:
        error?.message ||
        "Erro interno ao listar usuários.",
    });
  }
}