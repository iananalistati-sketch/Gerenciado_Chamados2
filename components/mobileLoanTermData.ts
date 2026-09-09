export interface MobileLoanTermData {
  loanId: string;
  status: string;
  originalCollector: string;
  originalSerial: string;
  originalBrand: string;
  originalModel: string;
  reserveCollector: string;
  reserveSerial: string;
  reserveBrand: string;
  reserveModel: string;
  destinationSector: string;
  serviceOrder: string;
  loanDate: string;
  loanResponsible: string;
  loanCollaboratorName: string;
  loanCollaboratorRegistration: string;
  loanCollaboratorRole: string;
  reason: string;
  observation: string;
  returnDate: string;
  returnResponsible: string;
  returnCollaboratorName: string;
  returnCollaboratorRegistration: string;
  returnCollaboratorRole: string;
  returnCondition: string;
  returnDetails: string;
  returnObservation: string;
}

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const getLoanValue = (
  headers: string[],
  row: string[],
  ...names: string[]
) => {
  const index = headers.findIndex((header) =>
    names.some((name) => normalize(header) === normalize(name))
  );
  return index === -1 ? "" : String(row[index] || "").trim();
};

export const loanRowToTermData = (
  headers: string[],
  row: string[]
): MobileLoanTermData => ({
  loanId: getLoanValue(headers, row, "ID_EMPRESTIMO"),
  status: getLoanValue(headers, row, "STATUS_EMPRESTIMO"),
  originalCollector: getLoanValue(headers, row, "COLETOR_SUBSTITUIDO"),
  originalSerial: getLoanValue(headers, row, "SN_SUBSTITUIDO"),
  originalBrand: getLoanValue(headers, row, "MARCA_EQUIPAMENTO_ORIGINAL"),
  originalModel: getLoanValue(headers, row, "MODELO_EQUIPAMENTO_ORIGINAL"),
  reserveCollector: getLoanValue(headers, row, "COLETOR_RESERVA"),
  reserveSerial: getLoanValue(headers, row, "SN_RESERVA"),
  reserveBrand: getLoanValue(headers, row, "MARCA_EQUIPAMENTO_RESERVA"),
  reserveModel: getLoanValue(headers, row, "MODELO_EQUIPAMENTO_RESERVA"),
  destinationSector: getLoanValue(headers, row, "SETOR_DESTINO"),
  serviceOrder: getLoanValue(headers, row, "ORDEM_SERVICO"),
  loanDate: getLoanValue(headers, row, "DATA_EMPRESTIMO"),
  loanResponsible: getLoanValue(headers, row, "RESPONSAVEL_EMPRESTIMO"),
  loanCollaboratorName: getLoanValue(headers, row, "COLABORADOR_EMPRESTIMO_NOME"),
  loanCollaboratorRegistration: getLoanValue(headers, row, "COLABORADOR_EMPRESTIMO_MATRICULA"),
  loanCollaboratorRole: getLoanValue(headers, row, "COLABORADOR_EMPRESTIMO_CARGO"),
  reason: getLoanValue(headers, row, "MOTIVO"),
  observation: getLoanValue(headers, row, "OBS"),
  returnDate: getLoanValue(headers, row, "DATA_DEVOLUCAO"),
  returnResponsible: getLoanValue(headers, row, "RESPONSAVEL_DEVOLUCAO"),
  returnCollaboratorName: getLoanValue(headers, row, "COLABORADOR_DEVOLUCAO_NOME"),
  returnCollaboratorRegistration: getLoanValue(headers, row, "COLABORADOR_DEVOLUCAO_MATRICULA"),
  returnCollaboratorRole: getLoanValue(headers, row, "COLABORADOR_DEVOLUCAO_CARGO"),
  returnCondition: getLoanValue(headers, row, "CONDICAO_DEVOLUCAO"),
  returnDetails: getLoanValue(headers, row, "DETALHES_DEVOLUCAO"),
  returnObservation: getLoanValue(headers, row, "OBS_DEVOLUCAO"),
});

