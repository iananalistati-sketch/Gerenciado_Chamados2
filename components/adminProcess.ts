// Regras compartilhadas das ações do Administrador no histórico do Controle de Mobiles:
// registro em aberto → pode ser modificado; registro finalizado/cancelado → pode ser excluído.
export type AdminProcess = "loan" | "external" | "replacement";

export const MODIFIED_COLUMN = "MODIFICADA_ADMIN";

export const PROCESS_CONFIG: Record<AdminProcess, { title: string; sheet: string; idColumn: string; statusColumn: string; openStatus: string }> = {
  loan: { title: "Empréstimo", sheet: "tbEmprestimosMobiles", idColumn: "ID_EMPRESTIMO", statusColumn: "STATUS_EMPRESTIMO", openStatus: "aberto" },
  external: { title: "Manutenção externa", sheet: "tbManutencaoExternaMobiles", idColumn: "ID_MANUTENCAO", statusColumn: "STATUS_MANUTENCAO", openStatus: "aberta" },
  // A substituição é um evento concluído: só pode ser excluída.
  replacement: { title: "Substituição", sheet: "tbSubstituicoesMobiles", idColumn: "ID_SUBSTITUICAO", statusColumn: "", openStatus: "" },
};

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export const rowValue = (headers: string[], row: string[], name: string) => {
  const index = headers.findIndex((header) => normalize(header) === normalize(name));
  return index === -1 ? "" : String(row[index] || "").trim();
};

export const isModifiedRow = (headers: string[], row: string[]) => normalize(rowValue(headers, row, MODIFIED_COLUMN)) === "sim";

export const isOpenRecord = (process: AdminProcess, headers: string[], row: string[]) => {
  const config = PROCESS_CONFIG[process];
  return Boolean(config.statusColumn) && normalize(rowValue(headers, row, config.statusColumn)) === config.openStatus;
};

// Campos que nem o Administrador altera pela edição (identidade, etapa e marcação de modificação).
export const isProtectedField = (process: AdminProcess, header: string) => {
  const config = PROCESS_CONFIG[process];
  return [config.idColumn, config.statusColumn, MODIFIED_COLUMN]
    .filter(Boolean)
    .some((name) => normalize(name) === normalize(header));
};
