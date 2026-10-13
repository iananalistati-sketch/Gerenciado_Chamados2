import { auth } from "../firebase";
import { DATA_BASE_HEADER, getDataBase } from "./dataBase";

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  const token = await currentUser.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  // Planilha usada pelo servidor: produção ou treinamento (escolhida no login).
  headers.set(DATA_BASE_HEADER, getDataBase());

  return fetch(input, {
    ...init,
    headers,
  });
}
