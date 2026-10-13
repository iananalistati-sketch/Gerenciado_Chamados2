// Descrição, para o Administrador, do que cada rollback fará antes da confirmação.
export type AdminProcess = "loan" | "external" | "replacement";

export interface AdminRollback {
  process: AdminProcess;
  id: string;
  description: string;
}

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const get = (headers: string[], row: string[], name: string) => {
  const index = headers.findIndex((header) => normalize(header) === normalize(name));
  return index === -1 ? "" : String(row[index] || "").trim();
};

export const describeRollback = (process: AdminProcess, headers: string[], row: string[]): AdminRollback | null => {
  if (process === "loan") {
    const id = get(headers, row, "ID_EMPRESTIMO");
    const status = normalize(get(headers, row, "STATUS_EMPRESTIMO"));
    const reserve = get(headers, row, "COLETOR_RESERVA") || "reserva";
    const original = get(headers, row, "COLETOR_SUBSTITUIDO") || "coletor substituído";
    const destination = get(headers, row, "SETOR_DESTINO") || "setor de destino";
    if (!id) return null;
    if (status === "aberto") {
      return { process, id, description: `Cancelar o empréstimo: ${reserve} volta Ativo no TI-SUPORTE e ${original} volta Ativo em ${destination}. O registro fica como CANCELADO.` };
    }
    if (status === "finalizado") {
      return { process, id, description: `Desfazer a devolução e reabrir o empréstimo: ${reserve} volta Emprestado em ${destination}, ${original} volta para Manutenção no TI-SUPORTE e os dados da devolução são apagados.` };
    }
    if (status === "cancelado") {
      return { process, id, description: `Reabrir o empréstimo cancelado: ${reserve} volta Emprestado em ${destination} e ${original} volta para Manutenção no TI-SUPORTE.` };
    }
    return null;
  }

  if (process === "external") {
    const id = get(headers, row, "ID_MANUTENCAO");
    const status = normalize(get(headers, row, "STATUS_MANUTENCAO"));
    const collector = get(headers, row, "COLETOR") || "coletor";
    const previous = get(headers, row, "LOCALIZACAO_ANTERIOR") || get(headers, row, "SETOR_ORIGEM") || "localização anterior";
    if (!id) return null;
    if (status === "aberta") {
      return { process, id, description: `Cancelar o envio para manutenção externa: ${collector} volta Ativo em ${previous}. O registro fica como CANCELADA.` };
    }
    if (status === "finalizada") {
      return { process, id, description: `Desfazer o retorno e reabrir a manutenção: ${collector} volta para MANUTENÇÃO EXTERNA e os dados do retorno são apagados. Se houve substituição pelo fornecedor, o coletor volta ao SN/MAC/Final anteriores.` };
    }
    if (status === "cancelada") {
      return { process, id, description: `Reabrir a manutenção cancelada: ${collector} volta para MANUTENÇÃO EXTERNA.` };
    }
    return null;
  }

  const id = get(headers, row, "ID_SUBSTITUICAO");
  if (!id) return null;
  return {
    process,
    id,
    description: `Desfazer a substituição: ${get(headers, row, "COLETOR")} volta ao SN ${get(headers, row, "SN_ANTERIOR") || "-"}, MAC ${get(headers, row, "MAC_ANTERIOR") || "-"} e Final ${get(headers, row, "FINAL_ANTERIOR") || "-"}. O registro sai do histórico de substituições (a cópia fica na auditoria).`,
  };
};
