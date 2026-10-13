import { FormEvent, useEffect, useRef, useState } from "react";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { setDataBase, type DataBase } from "../auth/dataBase";

const DATA_BASE_OPTIONS: Array<{ value: DataBase; label: string; description: string; color: string }> = [
  { value: "producao", label: "Produção", description: "Dados reais", color: "#3B82F6" },
  { value: "treinamento", label: "Treinamento", description: "Base para testes e capacitação", color: "#F59E0B" },
];

export default function Login() {
  const { login } = useAuth();
  const [dataBase, setSelectedDataBase] = useState<DataBase>("producao");
  const [dataBaseMenuOpen, setDataBaseMenuOpen] = useState(false);
  const dataBaseMenuRef = useRef<HTMLDivElement>(null);
  const selectedOption = DATA_BASE_OPTIONS.find((option) => option.value === dataBase) || DATA_BASE_OPTIONS[0];

  useEffect(() => {
    if (!dataBaseMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!dataBaseMenuRef.current?.contains(event.target as Node)) setDataBaseMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDataBaseMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [dataBaseMenuOpen]);

  function chooseDataBase(value: DataBase) {
    setSelectedDataBase(value);
    setDataBaseMenuOpen(false);
  }

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  function getLoginErrorMessage(error: unknown): string {
    if (!(error instanceof FirebaseError)) {
      return "Não foi possível realizar o login.";
    }

    switch (error.code) {
      case "auth/invalid-email":
        return "Informe um e-mail válido.";

      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "E-mail ou senha inválidos.";

      case "auth/user-disabled":
        return "Este usuário está desativado.";

      case "auth/too-many-requests":
        return "Muitas tentativas de acesso. Tente novamente mais tarde.";

      case "auth/network-request-failed":
        return "Falha de comunicação. Verifique sua conexão.";

      default:
        console.error("Erro no login:", error);
        return "Não foi possível realizar o login.";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setErrorMessage("Informe o e-mail e a senha.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      // A base escolhida vale para todas as requisições desta aba até o próximo login.
      setDataBase(dataBase);
      await login(email, password);
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setErrorMessage(
        "Informe seu e-mail antes de solicitar a recuperação de senha."
      );
      return;
    }

    try {
      setResettingPassword(true);
      setErrorMessage("");
      setSuccessMessage("");

      await sendPasswordResetEmail(auth, email.trim());

      setSuccessMessage(
        "E-mail de recuperação enviado. Verifique sua caixa de entrada."
      );
    } catch (error) {
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case "auth/invalid-email":
            setErrorMessage("Informe um e-mail válido.");
            break;

          case "auth/user-not-found":
            setErrorMessage("Usuário não encontrado.");
            break;

          case "auth/too-many-requests":
            setErrorMessage(
              "Muitas solicitações. Tente novamente mais tarde."
            );
            break;

          default:
            console.error(
              "Erro ao recuperar senha:",
              error
            );
            setErrorMessage(
              "Não foi possível enviar o e-mail de recuperação."
            );
        }
      } else {
        setErrorMessage(
          "Não foi possível enviar o e-mail de recuperação."
        );
      }
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="login-brand">
          <div className="login-logo">
            <img
              src="https://cssjd-ti.s3.us-east-2.amazonaws.com/LOGO.png"
              alt="Logo"
            />
          </div>

          <h1>Gestor de Chamados</h1>

          <p>
            Controle, acompanhamento e gestão de chamados de TI.
          </p>
        </div>

        <form
          className="login-card"
          onSubmit={handleSubmit}
        >
          <div className="login-card-header">
            <h2>Bem-vindo</h2>

            <p>
              Informe seus dados para acessar o sistema.
            </p>
          </div>

          <div className="login-field">
            <label htmlFor="login-email">
              E-mail
            </label>

            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              placeholder="usuario@empresa.com.br"
              disabled={submitting}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">
              Senha
            </label>

            <div className="login-password-wrapper">
              <input
                id="login-password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                autoComplete="current-password"
                placeholder="Digite sua senha"
                disabled={submitting}
              />

              <button
                type="button"
                className="login-password-toggle"
                onClick={() =>
                  setShowPassword(
                    previous =>
                      !previous
                  )
                }
                aria-label={
                  showPassword
                    ? "Ocultar senha"
                    : "Mostrar senha"
                }
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="login-field" ref={dataBaseMenuRef} style={{ position: "relative" }}>
            <label id="login-base-label" htmlFor="login-base-button">
              Base de dados
            </label>

            <button
              id="login-base-button"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={dataBaseMenuOpen}
              aria-labelledby="login-base-label login-base-button"
              onClick={() => setDataBaseMenuOpen((open) => !open)}
              disabled={submitting}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                width: "100%",
                padding: "11px 14px",
                borderRadius: "10px",
                border: `1px solid ${selectedOption.color}`,
                backgroundColor: `${selectedOption.color}1A`,
                color: "inherit",
                textAlign: "left",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              <span>
                <strong style={{ fontSize: "14px", color: selectedOption.color }}>{selectedOption.label}</strong>
                <span style={{ fontSize: "12px", opacity: 0.75 }}> · {selectedOption.description}</span>
              </span>
              <span aria-hidden="true" style={{ transform: dataBaseMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>▾</span>
            </button>

            {dataBaseMenuOpen && (
              <ul
                role="listbox"
                aria-labelledby="login-base-label"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  margin: "4px 0 0",
                  padding: "4px",
                  listStyle: "none",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  backgroundColor: "#0F172A",
                  color: "#F8FAFC",
                  boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
                }}
              >
                {DATA_BASE_OPTIONS.map((option) => {
                  const selected = dataBase === option.value;
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={selected}
                      tabIndex={0}
                      onClick={() => chooseDataBase(option.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          chooseDataBase(option.value);
                        }
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor: selected ? `${option.color}26` : "transparent",
                        borderLeft: `3px solid ${option.color}`,
                        marginBottom: "2px",
                      }}
                    >
                      <strong style={{ display: "block", fontSize: "14px", color: option.color }}>
                        {option.label}{selected ? " ✓" : ""}
                      </strong>
                      <span style={{ fontSize: "12px", opacity: 0.8 }}>{option.description}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {errorMessage && (
            <div
              className="login-message login-error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              className="login-message login-success"
              role="status"
            >
              {successMessage}
            </div>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Entrando..."
              : dataBase === "treinamento"
                ? "Entrar na base de treinamento"
                : "Entrar no sistema"}
          </button>

          <button
            type="button"
            className="login-forgot-password"
            onClick={handlePasswordReset}
            disabled={resettingPassword}
          >
            {resettingPassword
              ? "Enviando..."
              : "Esqueci minha senha"}
          </button>
        </form>
      </div>
    </div>
  );
}