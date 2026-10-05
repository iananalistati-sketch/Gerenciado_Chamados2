export const EXTERNAL_MAINTENANCE_SHEET = "tbManutencaoExternaMobiles";
export const EXTERNAL_MAINTENANCE_LOCATION = "MANUTENÇÃO EXTERNA";

export interface ExternalMaintenanceTermData {
  maintenanceId: string;
  status: string;
  collector: string;
  serial: string;
  brand: string;
  model: string;
  originSector: string;
  previousLocation: string;
  sendDate: string;
  receiptResponsible: string;
  deliveryName: string;
  deliveryRegistration: string;
  deliveryRole: string;
  serviceOrder: string;
  reportedDefect: string;
  accessories: string;
  sendObservation: string;
  returnDate: string;
  returnResponsible: string;
  receiverName: string;
  receiverRegistration: string;
  receiverRole: string;
  returnSector: string;
  serviceDone: string;
  returnObservation: string;
}

export const ACCESSORY_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "BATERIA", label: "Bateria" },
  { key: "CARREGADOR_BASE", label: "Carregador / base" },
  { key: "ALCA_CAPA", label: "Alça / capa" },
  { key: "CABO_USB", label: "Cabo USB" },
];

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const valueOf = (headers: string[], row: string[], name: string) => {
  const index = headers.findIndex((header) => normalize(header) === normalize(name));
  return index === -1 ? "" : String(row[index] || "").trim();
};

export const maintenanceRowToTermData = (
  headers: string[],
  row: string[]
): ExternalMaintenanceTermData => ({
  maintenanceId: valueOf(headers, row, "ID_MANUTENCAO"),
  status: valueOf(headers, row, "STATUS_MANUTENCAO"),
  collector: valueOf(headers, row, "COLETOR"),
  serial: valueOf(headers, row, "SN"),
  brand: valueOf(headers, row, "MARCA"),
  model: valueOf(headers, row, "MODELO"),
  originSector: valueOf(headers, row, "SETOR_ORIGEM"),
  previousLocation: valueOf(headers, row, "LOCALIZACAO_ANTERIOR"),
  sendDate: valueOf(headers, row, "DATA_ENVIO"),
  receiptResponsible: valueOf(headers, row, "RESPONSAVEL_RECEBIMENTO"),
  deliveryName: valueOf(headers, row, "COLABORADOR_ENTREGA_NOME"),
  deliveryRegistration: valueOf(headers, row, "COLABORADOR_ENTREGA_MATRICULA"),
  deliveryRole: valueOf(headers, row, "COLABORADOR_ENTREGA_CARGO"),
  serviceOrder: valueOf(headers, row, "ORDEM_SERVICO"),
  reportedDefect: valueOf(headers, row, "DEFEITO_RELATADO"),
  accessories: valueOf(headers, row, "ACESSORIOS_ENTREGUES"),
  sendObservation: valueOf(headers, row, "OBS_ENVIO"),
  returnDate: valueOf(headers, row, "DATA_RETORNO"),
  returnResponsible: valueOf(headers, row, "RESPONSAVEL_RETORNO"),
  receiverName: valueOf(headers, row, "COLABORADOR_RETORNO_NOME"),
  receiverRegistration: valueOf(headers, row, "COLABORADOR_RETORNO_MATRICULA"),
  receiverRole: valueOf(headers, row, "COLABORADOR_RETORNO_CARGO"),
  returnSector: valueOf(headers, row, "SETOR_RETORNO"),
  serviceDone: valueOf(headers, row, "SERVICO_REALIZADO"),
  returnObservation: valueOf(headers, row, "OBS_RETORNO"),
});

// A API devolve o registro com as chaves da planilha (ID_MANUTENCAO, COLETOR...).
export const apiRecordToTermData = (record: Record<string, string>) => {
  const headers = Object.keys(record || {});
  return maintenanceRowToTermData(headers, headers.map((header) => record[header]));
};

export const isExternalMaintenanceLocation = (location: string) =>
  normalize(location) === normalize(EXTERNAL_MAINTENANCE_LOCATION);
