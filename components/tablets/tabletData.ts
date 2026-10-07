import type { CSSProperties } from "react";

export const TABLET_SHEETS = {
  control: "tbControleTablets",
  apps: "tbTabletApps",
  config: "tbConfigTablets",
  loans: "tbEmprestimosTablets",
} as const;

export const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export const cell = (row: string[] | undefined, index: number) =>
  row && index !== -1 ? String(row[index] || "").trim() : "";

export const headerIndex = (headers: string[], ...names: string[]) =>
  headers.findIndex((header) => names.some((name) => normalize(header) === normalize(name)));

export const sortText = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

export const getToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];
};

export const STATUS_LABELS: Record<string, string> = {
  A: "Ativo",
  I: "Inativo",
  M: "Manutenção",
  E: "Emprestado",
};

export const statusLabel = (status: string) => STATUS_LABELS[String(status || "").toUpperCase()] || status || "Não informado";

export const statusColor = (status: string) => {
  switch (String(status || "").toUpperCase()) {
    case "A": return "#10B981";
    case "E": return "#3B82F6";
    case "M": return "#F59E0B";
    default: return "var(--text-muted)";
  }
};

// Status de atualização de um app: compara a versão instalada com a versão-alvo de tbConfigTablets.
export const appUpdateStatus = (version: string, target: string) => {
  if (!version || !target) return "SEM INFORMAÇÃO";
  return normalize(version) === normalize(target) ? "ATUALIZADO" : "PENDENTE";
};

export const updateStatusColor = (status: string) => {
  if (status === "ATUALIZADO") return "#10B981";
  if (status === "PENDENTE") return "#F59E0B";
  return "var(--text-muted)";
};

// Linhas carregadas de /api/data recebem o número da linha na planilha (1 = cabeçalho).
export const withOriginalIndex = (values: unknown): string[][] => {
  const rows = Array.isArray(values) ? values.filter((row) => Array.isArray(row)) as string[][] : [];
  rows.forEach((row, index) => {
    (row as any)._originalIndex = index + 1;
  });
  return rows;
};

export const originalIndexOf = (row: string[]) => {
  const value = (row as any)._originalIndex;
  return typeof value === "number" ? value : null;
};

export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  backgroundColor: "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-primary)",
  borderRadius: "8px",
  fontSize: "13px",
  outline: "none",
};

export const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "var(--text-secondary)",
  fontSize: "12px",
  fontWeight: 600,
};

export const buttonStyle = (variant: "primary" | "secondary" | "accent", color = "#3B82F6"): CSSProperties => ({
  padding: "10px 16px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  ...(variant === "primary"
    ? { backgroundColor: color, color: "#FFFFFF", border: "none" }
    : variant === "accent"
      ? { backgroundColor: "var(--bg-primary)", color, border: "1px solid var(--border-primary)" }
      : { backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" }),
});
