import { auth } from "../firebase";

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

  return fetch(input, {
    ...init,
    headers,
  });
}
