// Abas e rótulos por tipo de equipamento. Os componentes de empréstimo usam "mobile" por padrão.
export type DeviceType = "mobile" | "tablet";

export const DEVICE_CONFIG: Record<DeviceType, {
  controlSheet: string;
  loanSheet: string;
  idLabel: string;
}> = {
  mobile: { controlSheet: "tbControleMobiles", loanSheet: "tbEmprestimosMobiles", idLabel: "Coletor" },
  tablet: { controlSheet: "tbControleTablets", loanSheet: "tbEmprestimosTablets", idLabel: "Tablet" },
};

// Campo extra enviado às rotas de empréstimo somente para tablets (Mobiles mantém o corpo original).
export const deviceRequestFields = (device: DeviceType) => (device === "tablet" ? { device } : {});
