import React, { useEffect, useMemo, useState } from "react";
import { useAppDialog } from "../contexts/AppDialogContext";

interface NovoMobileModalProps {
  isOpen: boolean;
  headers: string[];
  allRows: string[][];
  mobileConfig: string[][];
  currentUserName: string;
  normalize: (value: string) => string;
  onClose: () => void;
  onCreate: (rowData: string[]) => Promise<void>;
}

export default function NovoMobileModal({
  isOpen,
  headers,
  allRows,
  mobileConfig,
  currentUserName,
  normalize,
  onClose,
  onCreate,
}: NovoMobileModalProps) {
  const { alert: showAlert } = useAppDialog();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const getHeader = (...names: string[]) =>
    headers.find((header) => names.some((name) => normalize(header) === normalize(name)));

  const setorHeader = getHeader("Setor");
  const quantidadeHeader = getHeader("Quantidade");
  const coletorHeader = getHeader("Coletor");
  const snHeader = getHeader("SN");
  const finalHeader = getHeader("FINAL");
  const macHeader = getHeader("MAC");
  const patrimonioRepromaqHeader = getHeader("PATRIMONIO_REPROMAQ", "Patrimônio Repromaq", "Patrimonio Repromaq");
  const ipHeader = getHeader("IP");
  const entregueHeader = getHeader("Entregue");
  const obsHeader = getHeader("Obs");
  const dataAtualizacaoHeader = getHeader("Data atualização", "Data atualizacao");
  const appHeader = getHeader("App de uso");
  const setorLocalizadoHeader = getHeader("Setor localizado");
  const versaoHeader = getHeader("Versão", "Versao");
  const contadorHeader = getHeader("Contador atualização", "Contador atualizacao");
  const statusHeader = getHeader("Status");
  const statusAtualizacaoHeader = getHeader("Status atualização", "Status atualizacao");
  const responsavelAtualizacaoHeader = getHeader("Responsável atualização", "Responsavel atualizacao");
  const ultimaConferenciaHeader = getHeader("Última conferência", "Ultima conferencia");
  const responsavelConferenciaHeader = getHeader("Responsável conferência", "Responsavel conferencia");

  const getToday = () => {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().split("T")[0];
  };

  const setores = useMemo(() => {
    if (!setorHeader) return [];
    const index = headers.indexOf(setorHeader);
    if (index === -1) return [];
    return Array.from(new Set(allRows.map((row) => String(row[index] || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }));
  }, [allRows, headers, setorHeader]);

  const { appOptions, targetVersions } = useMemo(() => {
    const result: string[] = [];
    const targets: Record<string, string> = {};
    const configHeaders = mobileConfig[0] || [];
    const appIdx = configHeaders.findIndex((header) => normalize(header) === normalize("APP_USO"));
    const targetIdx = configHeaders.findIndex((header) => normalize(header) === normalize("VERSAO_ALVO"));
    if (appIdx !== -1) {
      mobileConfig.slice(1).forEach((row) => {
        const app = String(row[appIdx] || "").trim();
        if (!app || normalize(app) === "todos") return;
        if (!result.some((item) => normalize(item) === normalize(app))) result.push(app);
        if (targetIdx !== -1) {
          const target = String(row[targetIdx] || "").trim();
          if (target) targets[normalize(app)] = target;
        }
      });
    }
    result.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }));
    return { appOptions: ["TODOS", ...result], targetVersions: targets };
  }, [mobileConfig, normalize]);

  const calculateUpdateStatus = (app: string, version: string) => {
    const normalizedApp = normalize(app);
    const currentVersion = String(version || "").trim();
    if (!app || normalizedApp === "todos" || !currentVersion || !targetVersions[normalizedApp]) return "SEM INFORMAÇÃO";
    return currentVersion === targetVersions[normalizedApp] ? "ATUALIZADO" : "PENDENTE";
  };

  useEffect(() => {
    if (!isOpen) return;
    const initialData: Record<string, string> = {};
    headers.forEach((header) => { initialData[header] = ""; });
    if (statusHeader) initialData[statusHeader] = "A";
    if (contadorHeader) initialData[contadorHeader] = "0";
    if (dataAtualizacaoHeader) initialData[dataAtualizacaoHeader] = getToday();
    if (responsavelAtualizacaoHeader) initialData[responsavelAtualizacaoHeader] = currentUserName;
    if (statusAtualizacaoHeader) initialData[statusAtualizacaoHeader] = "SEM INFORMAÇÃO";
    setFormData(initialData);
  }, [isOpen, headers, statusHeader, contadorHeader, dataAtualizacaoHeader, responsavelAtualizacaoHeader, statusAtualizacaoHeader, currentUserName]);

  if (!isOpen) return null;

  const handleChange = (header: string | undefined, value: string) => {
    if (!header) return;
    setFormData((previous) => {
      const next = { ...previous, [header]: value };
      if (header === setorHeader && setorLocalizadoHeader) {
        const currentLocation = String(previous[setorLocalizadoHeader] || "").trim();
        if (!currentLocation) next[setorLocalizadoHeader] = value;
      }
      if (header === appHeader && versaoHeader) {
        if (normalize(value) === "todos") next[versaoHeader] = "";
        else if (normalize(previous[appHeader || ""] || "") !== normalize(value)) next[versaoHeader] = "";
      }
      if (statusAtualizacaoHeader && (header === appHeader || header === versaoHeader)) {
        next[statusAtualizacaoHeader] = calculateUpdateStatus(appHeader ? next[appHeader] || "" : "", versaoHeader ? next[versaoHeader] || "" : "");
      }
      if (contadorHeader && (header === appHeader || header === versaoHeader)) {
        const app = appHeader ? next[appHeader] || "" : "";
        const version = versaoHeader ? next[versaoHeader] || "" : "";
        next[contadorHeader] = normalize(app) !== "todos" && version.trim() ? "1" : "0";
      }
      return next;
    });
  };

  const requireValue = (header: string | undefined, label: string) => {
    if (!header || !String(formData[header] || "").trim()) {
      void showAlert(`Informe ${label}.`, { variant: "warning" });
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!setorHeader || !setorLocalizadoHeader || !coletorHeader || !snHeader || !finalHeader || !macHeader || !appHeader || !statusHeader) {
      await showAlert("A estrutura de colunas do controle de mobiles está incompleta.", { variant: "error" });
      return;
    }
    if (!requireValue(setorHeader, "o Setor")) return;
    if (!requireValue(setorLocalizadoHeader, "o Setor localizado")) return;
    if (!requireValue(coletorHeader, "o Coletor")) return;
    if (!requireValue(snHeader, "o SN")) return;
    if (!requireValue(finalHeader, "o FINAL")) return;
    if (!requireValue(macHeader, "o MAC")) return;
    if (!requireValue(appHeader, "o App de uso")) return;
    if (!requireValue(statusHeader, "o Status")) return;

    const app = String(formData[appHeader] || "").trim();
    const version = versaoHeader ? String(formData[versaoHeader] || "").trim() : "";
    if (normalize(app) !== "todos" && !version) {
      await showAlert("Informe a Versão para equipamentos que utilizam um App específico.", { variant: "warning" });
      return;
    }

    const sn = String(formData[snHeader] || "").trim();
    const final = String(formData[finalHeader] || "").trim();
    if (!/^\d+$/.test(sn)) {
      await showAlert("O SN deve conter apenas números.", { variant: "warning" });
      return;
    }
    if (!/^\d+$/.test(final)) {
      await showAlert("O FINAL deve conter apenas números.", { variant: "warning" });
      return;
    }

    const status = String(formData[statusHeader] || "").trim().toUpperCase();
    if (!["A", "I"].includes(status)) {
      await showAlert("Informe um Status válido: Ativo ou Inativo.", { variant: "warning" });
      return;
    }

    const snIdx = headers.indexOf(snHeader);
    const coletorIdx = headers.indexOf(coletorHeader);
    const statusIdx = headers.indexOf(statusHeader);
    const coletor = String(formData[coletorHeader] || "").trim();

    const duplicateSn = allRows.some((row) => {
      const existingSn = String(row[snIdx] || "").trim();
      return existingSn && normalize(existingSn) === normalize(sn);
    });
    if (duplicateSn) {
      await showAlert(`Já existe um equipamento cadastrado com o SN "${sn}".`, { variant: "warning" });
      return;
    }

    if (status === "A") {
      const activeCollectorExists = allRows.some((row) => {
        const existingCollector = String(row[coletorIdx] || "").trim();
        const existingStatus = String(row[statusIdx] || "").trim().toUpperCase();
        return normalize(existingCollector) === normalize(coletor) && existingStatus === "A";
      });
      if (activeCollectorExists) {
        await showAlert(`Já existe um equipamento ATIVO utilizando o Coletor "${coletor}".`, { variant: "warning" });
        return;
      }
    }

    const preparedData = { ...formData };
    if (dataAtualizacaoHeader) preparedData[dataAtualizacaoHeader] = getToday();
    if (responsavelAtualizacaoHeader) preparedData[responsavelAtualizacaoHeader] = currentUserName;
    if (contadorHeader) preparedData[contadorHeader] = normalize(app) !== "todos" && version ? "1" : "0";
    if (statusAtualizacaoHeader) preparedData[statusAtualizacaoHeader] = calculateUpdateStatus(app, version);

    const rowData = headers.map((header) => preparedData[header] || "");
    setSaving(true);
    try {
      await onCreate(rowData);
      onClose();
    } catch (error: any) {
      await showAlert("Erro ao cadastrar equipamento: " + (error.message || "Erro desconhecido"), { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
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

  const labelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: 600,
  };

  const renderField = (
    header: string | undefined,
    label: string,
    options?: {
      type?: "text" | "date" | "select" | "textarea";
      required?: boolean;
      readOnly?: boolean;
      choices?: Array<{ value: string; label: string }>;
      numericOnly?: boolean;
      disabled?: boolean;
      helper?: string;
    }
  ) => {
    if (!header) return null;
    const type = options?.type || "text";
    const required = Boolean(options?.required);
    const readOnly = Boolean(options?.readOnly);
    const disabled = Boolean(options?.disabled);
    const displayLabel = `${label}${required ? " *" : ""}`;

    return (
      <label style={labelStyle}>
        {displayLabel}
        {type === "select" ? (
          <select value={formData[header] || ""} required={required} disabled={disabled} onChange={(event) => handleChange(header, event.target.value)} style={{ ...inputStyle, opacity: disabled ? 0.65 : 1 }}>
            <option value="">Selecione</option>
            {(options?.choices || []).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        ) : type === "textarea" ? (
          <textarea value={formData[header] || ""} rows={3} onChange={(event) => handleChange(header, event.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
        ) : (
          <input
            type={type}
            value={formData[header] || ""}
            required={required}
            readOnly={readOnly}
            disabled={disabled}
            inputMode={options?.numericOnly ? "numeric" : undefined}
            onChange={(event) => handleChange(header, options?.numericOnly ? event.target.value.replace(/\D/g, "") : event.target.value)}
            style={{ ...inputStyle, cursor: readOnly || disabled ? "not-allowed" : undefined, opacity: readOnly || disabled ? 0.7 : 1 }}
          />
        )}
        {options?.helper && <span style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: 500 }}>{options.helper}</span>}
      </label>
    );
  };

  const appValue = appHeader ? formData[appHeader] || "" : "";
  const isTodos = normalize(appValue) === "todos";

  return (
    <div className="mobile-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", zIndex: 1100 }}>
      <div className="mobile-modal-card" style={{ width: "100%", maxWidth: "900px", maxHeight: "90vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <form onSubmit={handleSubmit}>
          <div className="mobile-modal-header" style={{ padding: "20px 22px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "20px" }}>Novo Equipamento</h2>
              <p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>Os campos marcados com * são obrigatórios.</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer", fontSize: "18px" }}>×</button>
          </div>

          <div className="mobile-modal-grid" style={{ padding: "22px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px" }}>
            {renderField(setorHeader, "Setor", { type: "select", required: true, choices: setores.map((item) => ({ value: item, label: item })) })}
            {renderField(setorLocalizadoHeader, "Setor localizado", { type: "select", required: true, choices: setores.map((item) => ({ value: item, label: item })), helper: "Ao selecionar o Setor, ele será sugerido automaticamente aqui." })}
            {renderField(coletorHeader, "Coletor", { required: true })}
            {renderField(snHeader, "SN", { required: true, numericOnly: true })}
            {renderField(finalHeader, "FINAL", { required: true, numericOnly: true })}
            {renderField(macHeader, "MAC", { required: true })}
            {renderField(patrimonioRepromaqHeader, "Patrimônio Repromaq")}
            {renderField(ipHeader, "IP")}
            {renderField(appHeader, "App de uso", { type: "select", required: true, choices: appOptions.map((item) => ({ value: item, label: item })) })}
            {renderField(entregueHeader, "Entregue", { type: "date" })}
            {renderField(versaoHeader, "Versão", { required: Boolean(appValue) && !isTodos, disabled: isTodos, helper: isTodos ? "Para TODOS, as versões são controladas individualmente na opção Apps." : "Obrigatória quando o equipamento utiliza um App específico." })}
            {renderField(statusHeader, "Status", { type: "select", required: true, choices: [{ value: "A", label: "Ativo" }, { value: "I", label: "Inativo" }] })}
            {renderField(statusAtualizacaoHeader, "Status atualização", { readOnly: true, helper: "Calculado automaticamente pela versão atual e versão de referência." })}
            {renderField(dataAtualizacaoHeader, "Data atualização", { type: "date", readOnly: true })}
            {renderField(contadorHeader, "Contador atualização", { readOnly: true })}
            {renderField(responsavelAtualizacaoHeader, "Responsável atualização", { readOnly: true })}
            {obsHeader && <div style={{ gridColumn: "1 / -1" }}>{renderField(obsHeader, "Observação", { type: "textarea" })}</div>}
          </div>

          <div style={{ display: "none" }}>
            {quantidadeHeader}
            {ultimaConferenciaHeader}
            {responsavelConferenciaHeader}
          </div>

          <div className="mobile-modal-footer" style={{ padding: "16px 22px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ padding: "10px 18px", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600 }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ padding: "10px 20px", backgroundColor: "#3B82F6", color: "#FFFFFF", border: "none", borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600 }}>{saving ? "Cadastrando..." : "Cadastrar equipamento"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
