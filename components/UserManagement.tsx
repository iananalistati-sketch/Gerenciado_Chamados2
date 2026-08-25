import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { FirebaseError } from "firebase/app";
import { auth } from "../firebase";

type UserRole = "admin" | "analyst" | "viewer";

type UserManagementTab =
  | "users"
  | "new";

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

  const [editingUserId, setEditingUserId] =
    useState<string | null>(null);

  const [editingRole, setEditingRole] =
    useState<UserRole>("viewer");

  const [savingUser, setSavingUser] =
    useState(false);

  const [resettingUserId, setResettingUserId] =
    useState<string | null>(null);

  const [newPassword, setNewPassword] =
    useState("");

  const [
    confirmNewPassword,
    setConfirmNewPassword,
  ] = useState("");

  const [
    resettingPassword,
    setResettingPassword,
  ] = useState(false);

  const [activeTab, setActiveTab] =
    useState<UserManagementTab>("users");

  const [searchTerm, setSearchTerm] =
    useState("");

  async function handleToggleStatus(
    user: ManagedUser
  ) {
    const action =
      user.disabled
        ? "ativar"
        : "desativar";

    const confirmed =
      window.confirm(
        `Confirma ${action} o usuário ${user.email}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSavingUser(true);
      setErrorMessage("");
      setSuccessMessage("");

      const currentUser =
        auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Sessão inválida."
        );
      }

      const token =
        await currentUser.getIdToken();

      const response = await fetch(
        "/api/users/toggle-status",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            uid: user.uid,
            disabled: !user.disabled,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Não foi possível alterar o status."
        );
      }

      setSuccessMessage(
        result.message
      );

      await loadUsers();
    } catch (error) {
      console.error(
        "Erro ao alterar status:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro ao alterar status."
      );
    } finally {
      setSavingUser(false);
    }
  }

  async function handleUpdateRole(
    uid: string
  ) {
    try {
      setSavingUser(true);
      setErrorMessage("");
      setSuccessMessage("");

      const currentUser =
        auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Sessão inválida."
        );
      }

      const token =
        await currentUser.getIdToken();

      const response = await fetch(
        "/api/users/update-role",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            uid,
            role: editingRole,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Não foi possível atualizar o perfil."
        );
      }

      setSuccessMessage(
        "Perfil atualizado com sucesso."
      );

      setEditingUserId(null);

      await loadUsers();
    } catch (error) {
      console.error(
        "Erro ao atualizar perfil:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro ao atualizar perfil."
      );
    } finally {
      setSavingUser(false);
    }
  }

  async function handleResetPassword(
    uid: string
  ) {
    if (!newPassword) {
      setErrorMessage(
        "Informe a nova senha."
      );
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage(
        "A nova senha deve possuir pelo menos 6 caracteres."
      );
      return;
    }

    if (
      newPassword !==
      confirmNewPassword
    ) {
      setErrorMessage(
        "A confirmação da senha não confere."
      );
      return;
    }

    try {
      setResettingPassword(true);
      setErrorMessage("");
      setSuccessMessage("");

      const currentUser =
        auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Sessão inválida."
        );
      }

      const token =
        await currentUser.getIdToken();

      const response = await fetch(
        "/api/users/reset-password",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            uid,
            password: newPassword,
          }),
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
          "Não foi possível redefinir a senha."
        );
      }

      setSuccessMessage(
        "Senha redefinida com sucesso."
      );

      setResettingUserId(null);
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      console.error(
        "Erro ao redefinir senha:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro ao redefinir senha."
      );
    } finally {
      setResettingPassword(false);
    }
  }

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
      setActiveTab("users");
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const normalizedSearch =
    searchTerm.trim().toLowerCase();

  const filteredUsers = users.filter((user) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      user.name
        .toLowerCase()
        .includes(normalizedSearch) ||
      user.email
        .toLowerCase()
        .includes(normalizedSearch)
    );
  });

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

      setName("");
      setEmail("");
      setPassword("");
      setRole("viewer");

      await loadUsers();

      setActiveTab("users");

      setSuccessMessage(
        "Usuário cadastrado com sucesso."
      );
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
        backgroundColor: "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(5px)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 2000,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: "min(540px, 100vw)",
          height: "100vh",
          backgroundColor: "#1E293B",
          borderLeft: "1px solid #334155",
          boxShadow: "-20px 0 50px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "userDrawerEnter 0.25s ease-out",
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <style>
          {`
            @keyframes userDrawerEnter {
              from {
                transform: translateX(100%);
                opacity: 0;
              }

              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}
        </style>
        <div
          style={{
            padding: "24px 26px 0",
            borderBottom: "1px solid #334155",
            backgroundColor: "#1E293B",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "20px",
              marginBottom: "22px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  color: "#F8FAFC",
                  fontSize: "22px",
                }}
              >
                Administração de Usuários
              </h2>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#94A3B8",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                Gerencie usuários e níveis de acesso ao sistema.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Fechar"
              style={{
                minWidth: "36px",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "1px solid #475569",
                backgroundColor: "#334155",
                color: "#CBD5E1",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: "6px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab("users");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              style={{
                padding: "11px 16px",
                background: "transparent",
                border: "none",
                borderBottom:
                  activeTab === "users"
                    ? "2px solid #3B82F6"
                    : "2px solid transparent",
                color:
                  activeTab === "users"
                    ? "#F8FAFC"
                    : "#94A3B8",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Usuários
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("new");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              style={{
                padding: "11px 16px",
                background: "transparent",
                border: "none",
                borderBottom:
                  activeTab === "new"
                    ? "2px solid #3B82F6"
                    : "2px solid transparent",
                color:
                  activeTab === "new"
                    ? "#F8FAFC"
                    : "#94A3B8",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              + Novo usuário
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "24px 26px",
          }}
        >

        {errorMessage && (
          <div
            style={{
              marginBottom: "16px",
              padding: "11px 13px",
              borderRadius: "8px",
              backgroundColor: "rgba(220,38,38,0.12)",
              border: "1px solid rgba(220,38,38,0.35)",
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
              marginBottom: "16px",
              padding: "11px 13px",
              borderRadius: "8px",
              backgroundColor: "rgba(5,150,105,0.12)",
              border: "1px solid rgba(5,150,105,0.35)",
              color: "#6EE7B7",
              fontSize: "13px",
            }}
          >
            {successMessage}
          </div>
        )}

        {activeTab === "users" && (
          <>

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

          <div
            style={{
              marginBottom: "16px",
            }}
          >
            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Buscar por nome ou e-mail..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                backgroundColor: "#0F172A",
                color: "#F8FAFC",
                border: "1px solid #334155",
                borderRadius: "8px",
                outline: "none",
                fontSize: "13px",
              }}
            />
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
              Nenhum usuário cadastrado.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div
              style={{
                color: "#94A3B8",
                fontSize: "13px",
                padding: "12px 0",
              }}
            >
              Nenhum usuário encontrado para a busca.
            </div>
          ) : (
            <div
              style={{
                border: "1px solid #334155",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              {filteredUsers.map((user) => {
                const isCurrentUser =
                  user.uid === auth.currentUser?.uid;

                return (
                  <div
                    key={user.uid}
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid #334155",
                      backgroundColor: "#1E293B",
                    }}
                  >
                    {/* Informações e status */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              color: "#F8FAFC",
                              fontSize: "13px",
                              fontWeight: 700,
                            }}
                          >
                            {user.name || user.email}
                          </span>

                          {isCurrentUser && (
                            <span
                              style={{
                                padding: "3px 7px",
                                borderRadius: "999px",
                                backgroundColor:
                                  "rgba(59,130,246,0.15)",
                                color: "#93C5FD",
                                fontSize: "10px",
                                fontWeight: 700,
                              }}
                            >
                              Você
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            color: "#94A3B8",
                            fontSize: "12px",
                            marginTop: "4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.email}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "999px",
                            backgroundColor: "#334155",
                            color: "#CBD5E1",
                            fontSize: "11px",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.role === "admin"
                            ? "Administrador"
                            : user.role === "analyst"
                            ? "Analista"
                            : "Consulta"}
                        </span>

                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "999px",
                            backgroundColor: user.disabled
                              ? "rgba(220,38,38,0.15)"
                              : "rgba(5,150,105,0.15)",
                            color: user.disabled
                              ? "#FCA5A5"
                              : "#6EE7B7",
                            fontSize: "11px",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.disabled
                            ? "Inativo"
                            : "Ativo"}
                        </span>
                      </div>
                    </div>

                    {/* Área de ações */}
                    <div
                      style={{
                        marginTop: "13px",
                        paddingTop: "11px",
                        borderTop:
                          "1px solid rgba(51,65,85,0.65)",
                      }}
                    >
                      {editingUserId === user.uid ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <select
                            value={editingRole}
                            onChange={(event) =>
                              setEditingRole(
                                event.target.value as UserRole
                              )
                            }
                            disabled={savingUser}
                            style={{
                              flex: 1,
                              minWidth: "150px",
                              padding: "8px 10px",
                              backgroundColor: "#0F172A",
                              color: "#F8FAFC",
                              border: "1px solid #475569",
                              borderRadius: "7px",
                              fontSize: "12px",
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

                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateRole(user.uid)
                            }
                            disabled={savingUser}
                            style={{
                              padding: "8px 12px",
                              backgroundColor: "#3B82F6",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "7px",
                              cursor: savingUser
                                ? "not-allowed"
                                : "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                              opacity: savingUser ? 0.65 : 1,
                            }}
                          >
                            {savingUser
                              ? "Salvando..."
                              : "Salvar"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setEditingUserId(null)
                            }
                            disabled={savingUser}
                            style={{
                              padding: "8px 12px",
                              backgroundColor: "transparent",
                              color: "#94A3B8",
                              border: "1px solid #475569",
                              borderRadius: "7px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(user.uid);
                              setEditingRole(user.role);
                              setErrorMessage("");
                              setSuccessMessage("");
                            }}
                            style={{
                              padding: "7px 11px",
                              backgroundColor:
                                "rgba(59,130,246,0.10)",
                              border:
                                "1px solid rgba(59,130,246,0.35)",
                              borderRadius: "7px",
                              color: "#93C5FD",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            Editar perfil
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setResettingUserId(user.uid);
                              setEditingUserId(null);
                              setNewPassword("");
                              setConfirmNewPassword("");
                              setErrorMessage("");
                              setSuccessMessage("");
                            }}
                            style={{
                              padding: "7px 11px",
                              backgroundColor:
                                "rgba(148,163,184,0.08)",
                              border:
                                "1px solid rgba(148,163,184,0.25)",
                              borderRadius: "7px",
                              color: "#CBD5E1",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            Redefinir senha
                          </button>

                          {!isCurrentUser ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleStatus(user)
                              }
                              disabled={savingUser}
                              style={{
                                padding: "7px 11px",
                                backgroundColor: user.disabled
                                  ? "rgba(5,150,105,0.10)"
                                  : "rgba(220,38,38,0.08)",
                                border: user.disabled
                                  ? "1px solid rgba(5,150,105,0.30)"
                                  : "1px solid rgba(220,38,38,0.30)",
                                borderRadius: "7px",
                                color: user.disabled
                                  ? "#6EE7B7"
                                  : "#FCA5A5",
                                cursor: savingUser
                                  ? "not-allowed"
                                  : "pointer",
                                fontSize: "12px",
                                fontWeight: 600,
                                opacity: savingUser ? 0.6 : 1,
                              }}
                            >
                              {user.disabled
                                ? "Ativar usuário"
                                : "Desativar usuário"}
                            </button>
                          ) : (
                            <span
                              style={{
                                color: "#64748B",
                                fontSize: "11px",
                              }}
                            >
                              Sua conta não pode ser desativada
                            </span>
                          )}
                        </div>
                                            )}
                    </div>

                    {resettingUserId === user.uid && (
                      <div
                        style={{
                          marginTop: "14px",
                          padding: "14px",
                          backgroundColor: "#0F172A",
                          border: "1px solid #334155",
                          borderRadius: "9px",
                        }}
                      >
                        <div
                          style={{
                            marginBottom: "12px",
                          }}
                        >
                          <div
                            style={{
                              color: "#F8FAFC",
                              fontSize: "13px",
                              fontWeight: 700,
                            }}
                          >
                            Redefinir senha
                          </div>

                          <div
                            style={{
                              color: "#64748B",
                              fontSize: "11px",
                              marginTop: "3px",
                            }}
                          >
                            Defina uma nova senha para {user.email}.
                          </div>
                        </div>

                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          placeholder="Nova senha"
                          disabled={resettingPassword}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "10px 12px",
                            marginBottom: "10px",
                            backgroundColor: "#1E293B",
                            color: "#F8FAFC",
                            border: "1px solid #475569",
                            borderRadius: "7px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />

                        <input
                          type="password"
                          value={confirmNewPassword}
                          onChange={(event) =>
                            setConfirmNewPassword(event.target.value)
                          }
                          placeholder="Confirmar nova senha"
                          disabled={resettingPassword}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "10px 12px",
                            marginBottom: "12px",
                            backgroundColor: "#1E293B",
                            color: "#F8FAFC",
                            border: "1px solid #475569",
                            borderRadius: "7px",
                            outline: "none",
                            fontSize: "12px",
                          }}
                        />

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "8px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setResettingUserId(null);
                              setNewPassword("");
                              setConfirmNewPassword("");
                            }}
                            disabled={resettingPassword}
                            style={{
                              padding: "8px 11px",
                              backgroundColor: "transparent",
                              color: "#94A3B8",
                              border: "1px solid #475569",
                              borderRadius: "7px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            Cancelar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleResetPassword(user.uid)
                            }
                            disabled={resettingPassword}
                            style={{
                              padding: "8px 11px",
                              backgroundColor: "#3B82F6",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "7px",
                              cursor: resettingPassword
                                ? "not-allowed"
                                : "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                              opacity: resettingPassword
                                ? 0.65
                                : 1,
                            }}
                          >
                            {resettingPassword
                              ? "Salvando..."
                              : "Salvar nova senha"}
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>   

          </>
        )} 

        {activeTab === "new" && (
          <>
            <div
              style={{
                marginBottom: "24px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#F8FAFC",
                  fontSize: "17px",
                }}
              >
                Cadastrar novo usuário
              </h3>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#94A3B8",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                Informe os dados iniciais e determine o nível de acesso.
              </p>
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
                  event.target.value as UserRole
                )
              }
              disabled={submitting}
              style={{
                width: "100%",
                padding: "12px 14px",
                backgroundColor: "#0F172A",
                color: "#F8FAFC",
                border: "1px solid #334155",
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
        </>
        )}
      </div>
      </div>
    </div>
  );
}