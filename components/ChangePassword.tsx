import {
  FormEvent,
  useState,
} from "react";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

import { FirebaseError } from "firebase/app";
import { auth } from "../firebase";

interface ChangePasswordProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePassword({
  isOpen,
  onClose,
}: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [
    confirmNewPassword,
    setConfirmNewPassword,
  ] = useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  if (!isOpen) {
    return null;
  }

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function getErrorMessage(
    error: unknown
  ): string {
    if (!(error instanceof FirebaseError)) {
      return "Não foi possível alterar a senha.";
    }

    switch (error.code) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "A senha atual informada está incorreta.";

      case "auth/weak-password":
        return "A nova senha é muito fraca.";

      case "auth/requires-recent-login":
        return "Por segurança, faça login novamente antes de alterar a senha.";

      case "auth/too-many-requests":
        return "Muitas tentativas. Tente novamente mais tarde.";

      case "auth/network-request-failed":
        return "Falha de comunicação. Verifique sua conexão.";

      default:
        console.error(
          "Erro ao alterar senha:",
          error
        );

        return "Não foi possível alterar a senha.";
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (
      !currentPassword ||
      !newPassword ||
      !confirmNewPassword
    ) {
      setErrorMessage(
        "Preencha todos os campos."
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
        "A confirmação da nova senha não confere."
      );
      return;
    }

    if (
      currentPassword ===
      newPassword
    ) {
      setErrorMessage(
        "A nova senha deve ser diferente da senha atual."
      );
      return;
    }

    const currentUser =
      auth.currentUser;

    if (
      !currentUser ||
      !currentUser.email
    ) {
      setErrorMessage(
        "Sessão inválida. Faça login novamente."
      );
      return;
    }

    try {
      setSubmitting(true);

      const credential =
        EmailAuthProvider.credential(
          currentUser.email,
          currentPassword
        );

      await reauthenticateWithCredential(
        currentUser,
        credential
      );

      await updatePassword(
        currentUser,
        newPassword
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      setSuccessMessage(
        "Senha alterada com sucesso."
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
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
          "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 2100,
      }}
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          handleClose();
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "#1E293B",
          border:
            "1px solid #334155",
          borderRadius: "16px",
          boxShadow:
            "0 25px 50px rgba(0,0,0,0.45)",
          padding: "26px",
        }}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "flex-start",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: "#F8FAFC",
                fontSize: "21px",
              }}
            >
              Alterar senha
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                color: "#94A3B8",
                fontSize: "12px",
                lineHeight: 1.5,
              }}
            >
              Confirme sua senha atual e
              defina uma nova senha.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            title="Fechar"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              border:
                "1px solid #475569",
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
          <label
            style={{
              display: "block",
              marginBottom: "7px",
              color: "#CBD5E1",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Senha atual
          </label>

          <input
            type="password"
            value={currentPassword}
            onChange={(event) =>
              setCurrentPassword(
                event.target.value
              )
            }
            autoComplete="current-password"
            disabled={submitting}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "11px 13px",
              marginBottom: "16px",
              backgroundColor:
                "#0F172A",
              color: "#F8FAFC",
              border:
                "1px solid #334155",
              borderRadius: "8px",
              outline: "none",
            }}
          />

          <label
            style={{
              display: "block",
              marginBottom: "7px",
              color: "#CBD5E1",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Nova senha
          </label>

          <input
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(
                event.target.value
              )
            }
            autoComplete="new-password"
            disabled={submitting}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "11px 13px",
              marginBottom: "16px",
              backgroundColor:
                "#0F172A",
              color: "#F8FAFC",
              border:
                "1px solid #334155",
              borderRadius: "8px",
              outline: "none",
            }}
          />

          <label
            style={{
              display: "block",
              marginBottom: "7px",
              color: "#CBD5E1",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Confirmar nova senha
          </label>

          <input
            type="password"
            value={confirmNewPassword}
            onChange={(event) =>
              setConfirmNewPassword(
                event.target.value
              )
            }
            autoComplete="new-password"
            disabled={submitting}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "11px 13px",
              marginBottom: "18px",
              backgroundColor:
                "#0F172A",
              color: "#F8FAFC",
              border:
                "1px solid #334155",
              borderRadius: "8px",
              outline: "none",
            }}
          />

          {errorMessage && (
            <div
              style={{
                marginBottom: "16px",
                padding: "11px 13px",
                borderRadius: "8px",
                backgroundColor:
                  "rgba(220,38,38,0.12)",
                border:
                  "1px solid rgba(220,38,38,0.35)",
                color: "#FCA5A5",
                fontSize: "12px",
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
                backgroundColor:
                  "rgba(5,150,105,0.12)",
                border:
                  "1px solid rgba(5,150,105,0.35)",
                color: "#6EE7B7",
                fontSize: "12px",
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
              gap: "10px",
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              style={{
                padding: "10px 15px",
                backgroundColor:
                  "transparent",
                color: "#94A3B8",
                border:
                  "1px solid #475569",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "10px 15px",
                backgroundColor:
                  "#3B82F6",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
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
                ? "Alterando..."
                : "Alterar senha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}