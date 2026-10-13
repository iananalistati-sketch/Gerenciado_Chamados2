// Base de dados escolhida no login. Guardada por aba (sessionStorage) para que uma aba em
// treinamento não altere a base usada por outra aba em produção.
export type DataBase = "producao" | "treinamento";

const STORAGE_KEY = "app-base-dados";
let current: DataBase = "producao";

try {
  current = sessionStorage.getItem(STORAGE_KEY) === "treinamento" ? "treinamento" : "producao";
} catch {
  current = "producao";
}

export const getDataBase = (): DataBase => current;

export const isTrainingBase = () => current === "treinamento";

export function setDataBase(base: DataBase) {
  current = base;
  try {
    sessionStorage.setItem(STORAGE_KEY, base);
  } catch {
    // Sem armazenamento disponível, a escolha vale até recarregar a página.
  }
}

export const DATA_BASE_HEADER = "X-Base-Dados";
