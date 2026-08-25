import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { FirebaseError } from "firebase/app";
import { auth } from "../firebase";

type UserRole = "admin" | "analyst" | "viewer";

interface ManagedUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  disabled: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

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
  const [users, setUsers] =
    useState<ManagedUser[]>([]);

  const [loadingUsers, setLoadingUsers] =
    useState(false);

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      setErrorMessage("");

      const currentUser =
        auth.currentUser;

      if (!currentUser) {
        setErrorMessage(
          "Sessão inválida. Faça login novamente."
        );
        return;
      }

      const token =
        await currentUser.getIdToken();

      const response = await fetch(
        "/api/users/list",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const responseText =
        await response.text();

      let result: any = {};

      try {
        result = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        throw new Error(
          `Erro interno da API (${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Não foi possível carregar os usuários."
        );
      }

      setUsers(
        Array.isArray(result.users)
          ? result.users
          : []
      );
    } catch (error) {
      console.error(
        "Erro ao carregar usuários:",
        error
      );

      if (error instanceof Error) {
        setErrorMessage(
          error.message
        );
      } else {
        setErrorMessage(
          "Não foi possível carregar os usuários."
        );
      }
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

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

      const responseText = await response.text();

        let result: any = {};

        try {
        result = responseText
            ? JSON.parse(responseText)
            : {};
        } catch {
        console.error(
            "Resposta não JSON da API:",
            responseText
        );

        throw new Error(
            `Erro interno da API (${response.status}). Consulte os logs da Vercel.`
        );
        }

        if (!response.ok) {
        throw new Error(
            result.error ||
            `Erro ${response.status} ao cadastrar o usuário.`
        );
        }

      setSuccessMessage(
        "Usuário cadastrado com sucesso."
      );

      await loadUsers();

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

        <div
          style={{
            marginBottom: "24px",
            paddingBottom: "24px",
            borderBottom:
              "1px solid #334155",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#F8FAFC",
                fontSize: "16px",
              }}
            >
              Usuários cadastrados
            </h3>

            <button
              type="button"
              onClick={loadUsers}
              disabled={loadingUsers}
              style={{
                padding: "7px 12px",
                backgroundColor:
                  "#334155",
                color: "#CBD5E1",
                border:
                  "1px solid #475569",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              {loadingUsers
                ? "Atualizando..."
                : "Atualizar"}
            </button>
          </div>

          {loadingUsers ? (
            <div
              style={{
                color: "#94A3B8",
                fontSize: "13px",
              }}
            >
              Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                color: "#94A3B8",
                fontSize: "13px",
              }}
            >
              Nenhum usuário encontrado.
            </div>
          ) : (
            <div
              style={{
                maxHeight: "240px",
                overflowY: "auto",
                border:
                  "1px solid #334155",
                borderRadius: "10px",
              }}
            >
              {users.map(user => (
                <div
                  key={user.uid}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr auto auto",
                    gap: "12px",
                    alignItems: "center",
                    padding: "12px 14px",
                    borderBottom:
                      "1px solid #334155",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "#F8FAFC",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {user.name ||
                        user.email}
                    </div>

                    <div
                      style={{
                        color: "#94A3B8",
                        fontSize: "12px",
                        marginTop: "2px",
                      }}
                    >
                      {user.email}
                    </div>
                  </div>

                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: "999px",
                      backgroundColor:
                        "#334155",
                      color: "#CBD5E1",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {user.role === "admin"
                      ? "Administrador"
                      : user.role ===
                        "analyst"
                      ? "Analista"
                      : "Consulta"}
                  </span>

                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: "999px",
                      backgroundColor:
                        user.disabled
                          ? "rgba(220,38,38,0.15)"
                          : "rgba(5,150,105,0.15)",
                      color:
                        user.disabled
                          ? "#FCA5A5"
                          : "#6EE7B7",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {user.disabled
                      ? "Inativo"
                      : "Ativo"}
                  </span>
                </div>
              ))}
            </div>
          )}
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