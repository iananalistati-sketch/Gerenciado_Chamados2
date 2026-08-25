import { FormEvent, useState } from "react";
import { FirebaseError } from "firebase/app";
import { auth } from "../firebase";

type UserRole = "admin" | "analyst" | "viewer";

interface UserManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserManagement({
  isOpen,
  onClose,
}: UserManagementProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !name.trim() ||
      !email.trim() ||
      !password ||
      !role
    ) {
      setErrorMessage(
        "Preencha todos os campos obrigatórios."
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        "A senha deve possuir pelo menos 6 caracteres."
      );
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setErrorMessage(
          "Sessão inválida. Faça login novamente."
        );
        return;
      }

      const token =
        await currentUser.getIdToken();

      const response = await fetch(
        "/api/users/create",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            role,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Não foi possível cadastrar o usuário."
        );
      }

      setSuccessMessage(
        "Usuário cadastrado com sucesso."
      );

      setName("");
      setEmail("");
      setPassword("");
      setRole("viewer");
    } catch (error) {
      console.error(
        "Erro ao cadastrar usuário:",
        error
      );

      if (error instanceof FirebaseError) {
        setErrorMessage(
          "Erro de autenticação ao cadastrar usuário."
        );
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          "Não foi possível cadastrar o usuário."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor:
          "rgba(2, 6, 23, 0.82)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          backgroundColor: "#1E293B",
          border: "1px solid #334155",
          borderRadius: "16px",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          padding: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                color: "#F8FAFC",
              }}
            >
              Administração de Usuários
            </h2>

            <p
              style={{
                margin:
                  "6px 0 0",
                color: "#94A3B8",
                fontSize: "13px",
              }}
            >
              Cadastre novos usuários e
              defina o perfil de acesso.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              border: "none",
              backgroundColor:
                "#334155",
              color: "#CBD5E1",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#CBD5E1",
              }}
            >
              Nome
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              disabled={submitting}
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding:
                  "12px 14px",
                backgroundColor:
                  "#0F172A",
                color: "#F8FAFC",
                border:
                  "1px solid #334155",
                borderRadius: "9px",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#CBD5E1",
              }}
            >
              E-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              disabled={submitting}
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding:
                  "12px 14px",
                backgroundColor:
                  "#0F172A",
                color: "#F8FAFC",
                border:
                  "1px solid #334155",
                borderRadius: "9px",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#CBD5E1",
              }}
            >
              Senha inicial
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              disabled={submitting}
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding:
                  "12px 14px",
                backgroundColor:
                  "#0F172A",
                color: "#F8FAFC",
                border:
                  "1px solid #334155",
                borderRadius: "9px",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#CBD5E1",
              }}
            >
              Perfil
            </label>

            <select
              value={role}
              onChange={(event) =>
                setRole(
                  event.target
                    .value as UserRole
                )
              }
              disabled={submitting}
              style={{
                width: "100%",
                padding:
                  "12px 14px",
                backgroundColor:
                  "#0F172A",
                color: "#F8FAFC",
                border:
                  "1px solid #334155",
                borderRadius: "9px",
                outline: "none",
              }}
            >
              <option value="admin">
                Administrador
              </option>
              <option value="analyst">
                Analista
              </option>
              <option value="viewer">
                Consulta
              </option>
            </select>
          </div>

          {errorMessage && (
            <div
              style={{
                marginBottom:
                  "16px",
                padding:
                  "11px 13px",
                borderRadius:
                  "8px",
                backgroundColor:
                  "rgba(220,38,38,0.12)",
                border:
                  "1px solid rgba(220,38,38,0.35)",
                color: "#FCA5A5",
                fontSize: "13px",
              }}
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginBottom:
                  "16px",
                padding:
                  "11px 13px",
                borderRadius:
                  "8px",
                backgroundColor:
                  "rgba(5,150,105,0.12)",
                border:
                  "1px solid rgba(5,150,105,0.35)",
                color: "#6EE7B7",
                fontSize: "13px",
              }}
            >
              {successMessage}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent:
                "flex-end",
              gap: "12px",
              paddingTop: "8px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding:
                  "12px 18px",
                backgroundColor:
                  "transparent",
                color: "#94A3B8",
                border:
                  "1px solid #334155",
                borderRadius: "9px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding:
                  "12px 18px",
                backgroundColor:
                  "#3B82F6",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "9px",
                cursor: submitting
                  ? "not-allowed"
                  : "pointer",
                fontWeight: 700,
                opacity: submitting
                  ? 0.65
                  : 1,
              }}
            >
              {submitting
                ? "Cadastrando..."
                : "Cadastrar Usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}