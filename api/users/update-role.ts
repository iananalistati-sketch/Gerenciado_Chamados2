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

const validRoles = [
  "admin",
  "analyst",
  "viewer",
];

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
    const adminAuth = getAdminAuth();

    await requireAdmin(
      req.headers.authorization
    );

    const {
      uid,
      role,
    } = req.body ?? {};

    if (!uid || !role) {
      return res.status(400).json({
        error:
          "Usuário e perfil são obrigatórios.",
      });
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: "Perfil inválido.",
      });
    }

    const user =
      await adminAuth.getUser(uid);

    const currentClaims =
      user.customClaims || {};

    await adminAuth.setCustomUserClaims(
      uid,
      {
        ...currentClaims,
        role,
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Perfil atualizado com sucesso.",
    });
  } catch (error: any) {
    console.error(
      "Erro ao alterar perfil:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Não foi possível alterar o perfil.",
    });
  }
}