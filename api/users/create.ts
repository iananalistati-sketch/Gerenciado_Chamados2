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
  if (req.method !== "POST") {
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
      name,
      email,
      password,
      role,
    } = req.body ?? {};

    if (
      !name ||
      !email ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        error:
          "Nome, e-mail, senha e perfil são obrigatórios.",
      });
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: "Perfil inválido.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          "A senha deve possuir pelo menos 6 caracteres.",
      });
    }

    const newUser =
      await adminAuth.createUser({
        email: email.trim(),
        password,
        displayName: name.trim(),
        disabled: false,
      });

    await adminAuth.setCustomUserClaims(
      newUser.uid,
      {
        role,
      }
    );

    return res.status(201).json({
      success: true,
      user: {
        uid: newUser.uid,
        name: newUser.displayName,
        email: newUser.email,
        role,
      },
    });
  } catch (error: any) {
    console.error(
      "Erro ao criar usuário:",
      error
    );

    if (
      error?.code ===
      "auth/email-already-exists"
    ) {
      return res.status(409).json({
        error:
          "Já existe um usuário com este e-mail.",
      });
    }

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
        "Erro interno ao cadastrar usuário.",
    });
  }
}