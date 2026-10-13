import { FormEvent, useState } from "react";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { setDataBase, type DataBase } from "../auth/dataBase";

const DATA_BASE_OPTIONS: Array<{ value: DataBase; label: string; description: string }> = [
  { value: "producao", label: "Produção", description: "Dados reais" },
  { value: "treinamento", label: "Treinamento", description: "Base para testes e capacitação" },
];

export default function Login() {
  const { login } = useAuth();
  const [dataBase, setSelectedDataBase] = useState<DataBase>("producao");

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
            <span id="login-base-label" style={{ fontSize: "13px", fontWeight: 600 }}>Base de dados</span>
            <div role="radiogroup" aria-labelledby="login-base-label" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
              {DATA_BASE_OPTIONS.map((option) => {
                const selected = dataBase === option.value;
                const color = option.value === "treinamento" ? "#F59E0B" : "#3B82F6";
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedDataBase(option.value)}
                    disabled={submitting}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: selected ? `2px solid ${color}` : "1px solid var(--border-primary, #CBD5E1)",
                      backgroundColor: selected ? `${color}1A` : "transparent",
                      color: "inherit",
                      textAlign: "left",
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    <strong style={{ display: "block", fontSize: "13px", color: selected ? color : "inherit" }}>{option.label}</strong>
                    <span style={{ fontSize: "11px", opacity: 0.75 }}>{option.description}</span>
                  </button>
                );
              })}
            </div>
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