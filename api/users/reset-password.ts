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
      password,
    } = req.body ?? {};

    if (!uid || !password) {
      return res.status(400).json({
        error:
          "Usuário e nova senha são obrigatórios.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          "A senha deve possuir pelo menos 6 caracteres.",
      });
    }

    await adminAuth.updateUser(uid, {
      password,
    });

    return res.status(200).json({
      success: true,
      message:
        "Senha redefinida com sucesso.",
    });
  } catch (error: any) {
    console.error(
      "Erro ao redefinir senha:",
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

    return res.status(500).json({
      error:
        error?.message ||
        "Não foi possível redefinir a senha.",
    });
  }
}