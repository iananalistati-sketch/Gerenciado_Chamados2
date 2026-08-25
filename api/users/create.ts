import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

import {
  adminAuth,
} from "../_firebaseAdmin";

import {
  requireAdmin,
} from "../_requireAdmin";

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

    return res.status(403).json({
      error:
        error?.message ||
        "Não foi possível criar o usuário.",
    });
  }
}