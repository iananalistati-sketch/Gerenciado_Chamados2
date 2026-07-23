import { FormEvent, useState } from "react";
import { FirebaseError } from "firebase/app";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

      await login(email, password);
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Sistema de Chamados</h1>
        <p>Informe seus dados para acessar.</p>

        <label htmlFor="login-email">E-mail</label>

        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="usuario@empresa.com.br"
          disabled={submitting}
        />

        <label htmlFor="login-password">Senha</label>

        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="Digite sua senha"
          disabled={submitting}
        />

        {errorMessage && (
          <div className="login-error" role="alert">
            {errorMessage}
          </div>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}