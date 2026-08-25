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

    const decodedToken =
      await requireAdmin(
        req.headers.authorization
      );

    const {
      uid,
      disabled,
    } = req.body ?? {};

    if (
      !uid ||
      typeof disabled !== "boolean"
    ) {
      return res.status(400).json({
        error:
          "Usuário e status são obrigatórios.",
      });
    }

    if (decodedToken.uid === uid) {
      return res.status(400).json({
        error:
          "Você não pode desativar sua própria conta.",
      });
    }

    await adminAuth.updateUser(
      uid,
      {
        disabled,
      }
    );

    return res.status(200).json({
      success: true,
      message: disabled
        ? "Usuário desativado com sucesso."
        : "Usuário ativado com sucesso.",
    });
  } catch (error: any) {
    console.error(
      "Erro ao alterar status:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Não foi possível alterar o status.",
    });
  }
}