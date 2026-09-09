import React, { useEffect, useMemo, useState } from "react";
import SubstituirMobileModal from "./SubstituirMobileModal";
import { apiFetch } from "../auth/api";
import { useAppDialog } from "../contexts/AppDialogContext";

interface EditarMobileModalProps {
  isOpen: boolean;
  row: string[] | null;
  headers: string[];
  allRows: string[][];
  mobileApps: string[][];
  mobileConfig: string[][];
  currentUserName: string;
  normalize: (value: string) => string;
  onClose: () => void;
  onSave: (rowData: string[], rowIndex: number) => Promise<void>;
  onSaveMobileApp: (rowData: string[], rowIndex: number) => Promise<void>;
  onRefresh: () => void | Promise<void>;
}

export default function EditarMobileModal({
  isOpen,
  row,
  headers,
  allRows,
  mobileApps,
  mobileConfig,
  currentUserName,
  normalize,
  onClose,
  onSave,
  onSaveMobileApp,
  onRefresh,
}: EditarMobileModalProps) {
  const { alert: showAlert, confirm: showConfirm, prompt: showPrompt } = useAppDialog();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [returning, setReturning] = useState(false);
  const [showSubstitute, setShowSubstitute] = useState(false);

  const getHeader = (...names: string[]) =>
    headers.find((header) =>
      names.some((name) => normalize(header) === normalize(name))
    );

  const setorHeader = getHeader("Setor");
  const coletorHeader = getHeader("Coletor");
  const snHeader = getHeader("SN");
  const finalHeader = getHeader("FINAL");
  const macHeader = getHeader("MAC");
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

  const uniqueValues = (header: string | undefined) => {
    if (!header) return [];
    const index = headers.indexOf(header);
    if (index === -1) return [];
    return Array.from(
      new Set(
        allRows
          .map((item) => String(item[index] || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  };

  const sectors = useMemo(() => uniqueValues(setorHeader), [allRows, headers, setorHeader]);

  const configuredApps = useMemo(() => {
    const configHeaders = mobileConfig[0] || [];
    const appIdx = configHeaders.findIndex((header) => normalize(header) === normalize("APP_USO"));
    if (appIdx === -1) return [];
    return Array.from(
      new Set(
        mobileConfig
          .slice(1)
          .map((item) => String(item[appIdx] || "").trim())
          .filter((value) => value && normalize(value) !== "todos")
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  }, [mobileConfig, normalize]);

  const targetVersions = useMemo(() => {
    const result: Record<string, string> = {};
    const configHeaders = mobileConfig[0] || [];
    const appIdx = configHeaders.findIndex((header) => normalize(header) === normalize("APP_USO"));
    const versionIdx = configHeaders.findIndex((header) => normalize(header) === normalize("VERSAO_ALVO"));
    if (appIdx === -1 || versionIdx === -1) return result;
    mobileConfig.slice(1).forEach((item) => {
      const app = String(item[appIdx] || "").trim();
      const version = String(item[versionIdx] || "").trim();
      if (app) result[normalize(app)] = version;
    });
    return result;
  }, [mobileConfig, normalize]);

  useEffect(() => {
    if (!isOpen || !row) return;
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      values[header] = row[index] || "";
    });
    setFormData(values);
    setShowSubstitute(false);
  }, [isOpen, row, headers]);

  if (!isOpen || !row) return null;

  const currentStatus = statusHeader ? String(formData[statusHeader] || "").trim().toUpperCase() : "";
  const currentSector = setorHeader ? String(formData[setorHeader] || "").trim() : "";
  const currentCollector = coletorHeader ? String(formData[coletorHeader] || "").trim() : "";
  const currentLocation = setorLocalizadoHeader ? String(formData[setorLocalizadoHeader] || "").trim() : "";
  const currentApp = appHeader ? String(formData[appHeader] || "").trim() : "";
  const currentVersion = versaoHeader ? String(formData[versaoHeader] || "").trim() : "";

  const originalAppIdx = appHeader ? headers.indexOf(appHeader) : -1;
  const originalApp = originalAppIdx !== -1 ? String(row[originalAppIdx] || "").trim() : "";
  const isTodos = normalize(currentApp) === "todos";

  const automaticStatus = (() => {
    if (isTodos) return "Gerenciado individualmente por App";
    const target = targetVersions[normalize(currentApp)];
    if (!currentVersion || !target) return "SEM INFORMAÇÃO";
    return currentVersion === target ? "ATUALIZADO" : "PENDENTE";
  })();

  const canTemporarilyReplace = currentStatus === "A" && normalize(currentSector) !== normalize("TI-SUPORTE");
  const canFinalizeLoan = currentStatus === "E" && normalize(currentSector) === normalize("TI-SUPORTE");
  const isOperationalStatus = currentStatus === "M" || currentStatus === "E";

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "A": return "Ativo";
      case "I": return "Inativo";
      case "M": return "Manutenção";
      case "E": return "Emprestado";
      default: return status || "Não informado";
    }
  };

  const handleChange = (header: string | undefined, value: string) => {
    if (!header) return;
    setFormData((previous) => ({ ...previous, [header]: value }));
  };

  const handleSectorChange = (value: string) => {
    if (!setorHeader) return;
    setFormData((previous) => ({ ...previous, [setorHeader]: value }));
  };

  const getToday = () => {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().split("T")[0];
  };

  const handleFinalizeLoan = async () => {
    if (!canFinalizeLoan || !currentCollector) return;
    const confirmed = await showConfirm(`O equipamento original voltará para Ativo e a reserva "${currentCollector}" ficará disponível novamente.`, {
      title: "Finalizar empréstimo",
      variant: "warning",
      confirmLabel: "Continuar",
    });
    if (!confirmed) return;

    const updateLocation = await showConfirm("A reserva retornará para TI-SUPORTE e você poderá informar onde o equipamento original ficará localizado.", {
      title: "Atualizar localização",
      variant: "info",
      confirmLabel: "Sim, atualizar",
      cancelLabel: "Manter atual",
    });
    let returnSector = "";
    if (updateLocation) {
      const informedSector = await showPrompt("Informe o setor de localização para devolução do equipamento original:", {
        title: "Setor de devolução",
        variant: "info",
        defaultValue: currentLocation || currentSector || "",
        confirmLabel: "Continuar",
      });
      if (informedSector === null) return;
      returnSector = informedSector.trim();
      if (!returnSector) {
        await showAlert("Informe o setor de localização da devolução.", { variant: "warning" });
        return;
      }
    }

    const observation = await showPrompt("Observação da devolução (opcional):", {
      title: "Observação da devolução",
      variant: "info",
      multiline: true,
      placeholder: "Adicione uma observação, se necessário",
      confirmLabel: "Finalizar empréstimo",
    });
    if (observation === null) return;
    setReturning(true);

    try {
      const response = await apiFetch("/api/mobiles/loan-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reserveCollector: currentCollector, responsible: currentUserName, observation: observation.trim(), updateLocation, returnSector }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao finalizar empréstimo temporário.");
      await Promise.resolve(onRefresh());
      await showAlert(`Empréstimo ${result.loanId || ""} finalizado. O equipamento reserva voltou a ficar disponível.`.trim(), { title: "Empréstimo finalizado", variant: "success", confirmLabel: "Concluir" });
      onClose();
    } catch (error: any) {
      await showAlert("Erro ao finalizar empréstimo: " + (error.message || "Erro desconhecido"), { variant: "error" });
    } finally {
      setReturning(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!setorHeader || !setorLocalizadoHeader || !coletorHeader || !snHeader || !finalHeader || !macHeader || !appHeader || !statusHeader) {
      await showAlert("Não foi possível identificar todos os campos obrigatórios do equipamento.", { variant: "error" });
      return;
    }

    const setor = String(formData[setorHeader] || "").trim();
    const localizado = String(formData[setorLocalizadoHeader] || "").trim();
    const coletor = String(formData[coletorHeader] || "").trim();
    const sn = String(formData[snHeader] || "").trim();
    const finalValue = String(formData[finalHeader] || "").trim();
    const mac = String(formData[macHeader] || "").trim();
    const app = String(formData[appHeader] || "").trim();
    const status = String(formData[statusHeader] || "").trim().toUpperCase();
    const version = versaoHeader ? String(formData[versaoHeader] || "").trim() : "";

    if (!setor || !localizado || !coletor || !sn || !finalValue || !mac || !app || !status) {
      await showAlert("Preencha todos os campos obrigatórios: Setor, Setor localizado, Coletor, SN, FINAL, MAC, App de uso e Status.", { variant: "warning" });
      return;
    }
    if (!/^\d+$/.test(sn)) {
      await showAlert("SN deve conter apenas números.", { variant: "warning" });
      return;
    }
    if (!/^\d+$/.test(finalValue)) {
      await showAlert("FINAL deve conter apenas números.", { variant: "warning" });
      return;
    }
    if (!isTodos && !version) {
      await showAlert("Informe a Versão para equipamentos vinculados a um App específico.", { variant: "warning" });
      return;
    }
    if (normalize(originalApp) !== normalize(app)) {
      await showAlert("A alteração entre TODOS e um App específico ainda não é permitida pela edição simples. Essa mudança exige reorganizar os registros de tbMobileApps.", { variant: "warning" });
      return;
    }

    const originalStatusIdx = headers.findIndex((header) => normalize(header) === normalize("Status"));
    const originalStatus = originalStatusIdx !== -1 ? String(row[originalStatusIdx] || "").trim().toUpperCase() : "";
    if ((status === "M" || status === "E") && status !== originalStatus) {
      await showAlert("Os status Manutenção e Emprestado são controlados automaticamente pela rotina de empréstimo e não podem ser definidos manualmente.", { variant: "warning" });
      return;
    }

    const currentRowIndex = (row as any)._originalIndex;
    if (currentRowIndex === undefined || currentRowIndex === null) {
      await showAlert("Não foi possível identificar a linha original do equipamento.", { variant: "error" });
      return;
    }

    const snIdx = headers.findIndex((header) => normalize(header) === normalize("SN"));
    const coletorIdx = headers.findIndex((header) => normalize(header) === normalize("Coletor"));
    const statusIdx = headers.findIndex((header) => normalize(header) === normalize("Status"));

    const duplicateSn = allRows.some((otherRow) => {
      const otherRowIndex = (otherRow as any)._originalIndex;
      if (otherRowIndex === currentRowIndex) return false;
      const otherSn = String(otherRow[snIdx] || "").trim();
      return otherSn !== "" && normalize(otherSn) === normalize(sn);
    });
    if (duplicateSn) {
      await showAlert(`Já existe outro equipamento cadastrado com o SN "${sn}".`, { variant: "warning" });
      return;
    }

    if (status === "A") {
      const activeCollectorExists = allRows.some((otherRow) => {
        const otherRowIndex = (otherRow as any)._originalIndex;
        if (otherRowIndex === currentRowIndex) return false;
        const otherCollector = String(otherRow[coletorIdx] || "").trim();
        const otherStatus = String(otherRow[statusIdx] || "").trim().toUpperCase();
        return normalize(otherCollector) === normalize(coletor) && otherStatus === "A";
      });
      if (activeCollectorExists) {
        await showAlert(`Já existe outro equipamento ATIVO utilizando o Coletor "${coletor}".`, { variant: "warning" });
        return;
      }
    }

    const updatedData = { ...formData };
    const originalVersion = versaoHeader ? String(row[headers.indexOf(versaoHeader)] || "").trim() : "";
    const versionChanged = !isTodos && originalVersion !== version;

    if (statusAtualizacaoHeader) updatedData[statusAtualizacaoHeader] = isTodos ? "" : automaticStatus;
    if (versionChanged) {
      if (dataAtualizacaoHeader) updatedData[dataAtualizacaoHeader] = getToday();
      if (responsavelAtualizacaoHeader) updatedData[responsavelAtualizacaoHeader] = currentUserName;
      if (contadorHeader) {
        const originalCounter = Number(String(row[headers.indexOf(contadorHeader)] || "0").trim().replace(",", ".")) || 0;
        updatedData[contadorHeader] = String(originalCounter + 1);
      }
    }

    const updatedRow = headers.map((header) => updatedData[header] || "");
    setSaving(true);

    try {
      if (versionChanged) {
        const appHeaders = mobileApps[0] || [];
        const appCollectorIdx = appHeaders.findIndex((header) => normalize(header) === normalize("COLETOR"));
        const appUsoIdx = appHeaders.findIndex((header) => normalize(header) === normalize("APP_USO"));
        const appVersionIdx = appHeaders.findIndex((header) => normalize(header) === normalize("VERSAO"));
        const appDateIdx = appHeaders.findIndex((header) => normalize(header) === normalize("DATA_ATUALIZACAO"));
        const appStatusIdx = appHeaders.findIndex((header) => normalize(header) === normalize("STATUS_ATUALIZACAO"));
        const appResponsibleIdx = appHeaders.findIndex((header) => normalize(header) === normalize("RESPONSAVEL_ATUALIZACAO"));
        const appCounterIdx = appHeaders.findIndex((header) => normalize(header) === normalize("CONTADOR_ATUALIZACAO"));

        const matchingRows = mobileApps.slice(1).filter((item) =>
          appCollectorIdx !== -1 &&
          appUsoIdx !== -1 &&
          normalize(String(item[appCollectorIdx] || "")) === normalize(coletor) &&
          normalize(String(item[appUsoIdx] || "")) === normalize(app)
        );

        if (matchingRows.length !== 1) {
          throw new Error(
            matchingRows.length === 0
              ? `Não foi encontrado o registro do App ${app} para o coletor ${coletor} em tbMobileApps.`
              : `Foram encontrados múltiplos registros do App ${app} para o coletor ${coletor} em tbMobileApps.`
          );
        }

        const appRow = matchingRows[0];
        const originalIndex = (appRow as any)._originalIndex;
        if (originalIndex === undefined || originalIndex === null) {
          throw new Error("Não foi possível identificar a linha original do App em tbMobileApps.");
        }

        const updatedAppRow = [...appRow];
        if (appVersionIdx !== -1) updatedAppRow[appVersionIdx] = version;
        if (appDateIdx !== -1) updatedAppRow[appDateIdx] = getToday();
        if (appStatusIdx !== -1) updatedAppRow[appStatusIdx] = automaticStatus;
        if (appResponsibleIdx !== -1) updatedAppRow[appResponsibleIdx] = currentUserName;
        if (appCounterIdx !== -1) {
          const currentCounter = Number(String(appRow[appCounterIdx] || "0").trim().replace(",", ".")) || 0;
          updatedAppRow[appCounterIdx] = String(currentCounter + 1);
        }

        await onSaveMobileApp(updatedAppRow, originalIndex);
      }

      await onSave(updatedRow, currentRowIndex);
      await Promise.resolve(onRefresh());
      onClose();
    } catch (error: any) {
      await showAlert("Erro ao salvar equipamento: " + error.message, { variant: "error" });
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
  const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 };
  const requiredLabel = (label: string, required = true) => `${label}${required ? " *" : ""}`;

  const textField = (header: string | undefined, label: string, required = false, numeric = false) => {
    if (!header) return null;
    return (
      <label style={labelStyle}>
        {requiredLabel(label, required)}
        <input
          type="text"
          inputMode={numeric ? "numeric" : undefined}
          pattern={numeric ? "[0-9]*" : undefined}
          required={required}
          value={formData[header] || ""}
          onChange={(event) => handleChange(header, numeric ? event.target.value.replace(/\D/g, "") : event.target.value)}
          style={inputStyle}
        />
      </label>
    );
  };

  const selectField = (header: string | undefined, label: string, options: string[], required = true, onValueChange?: (value: string) => void) => {
    if (!header) return null;
    return (
      <label style={labelStyle}>
        {requiredLabel(label, required)}
        <select
          required={required}
          value={formData[header] || ""}
          onChange={(event) => onValueChange ? onValueChange(event.target.value) : handleChange(header, event.target.value)}
          style={inputStyle}
        >
          <option value="">Selecione</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  };

  return (
    <div className="mobile-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", zIndex: 1100 }}>
      <div className="mobile-modal-card" style={{ width: "100%", maxWidth: "900px", maxHeight: "90vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <form onSubmit={handleSubmit}>
          <div className="mobile-modal-header" style={{ padding: "20px 22px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "20px" }}>Editar Equipamento</h2>
              <p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>{coletorHeader ? formData[coletorHeader] || "Equipamento" : "Equipamento"}</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving || returning} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontSize: "18px" }}>×</button>
          </div>

          <div className="mobile-modal-grid" style={{ padding: "22px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px" }}>
            {selectField(setorHeader, "Setor", sectors, true, handleSectorChange)}
            {selectField(setorLocalizadoHeader, "Setor localizado", sectors, true)}
            {textField(coletorHeader, "Coletor", true)}
            {textField(snHeader, "SN", true, true)}
            {textField(finalHeader, "FINAL", true, true)}
            {textField(macHeader, "MAC", true)}
            {textField(ipHeader, "IP", false)}
            {selectField(appHeader, "App de uso", [...configuredApps, "TODOS"], true)}
            {entregueHeader && <label style={labelStyle}>{requiredLabel("Entregue", false)}<input type="date" value={formData[entregueHeader] || ""} onChange={(event) => handleChange(entregueHeader, event.target.value)} style={inputStyle} /></label>}
            {versaoHeader && <label style={labelStyle}>{requiredLabel("Versão", !isTodos)}<input type="text" required={!isTodos} disabled={isTodos} value={isTodos ? "" : formData[versaoHeader] || ""} onChange={(event) => handleChange(versaoHeader, event.target.value)} style={{ ...inputStyle, opacity: isTodos ? 0.6 : 1, cursor: isTodos ? "not-allowed" : "text" }} /></label>}

            {statusHeader && (isOperationalStatus ? (
              <label style={labelStyle}>Status *<input type="text" value={getStatusLabel(currentStatus)} readOnly style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.75 }} /><span style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: 500 }}>Status controlado automaticamente pela rotina de empréstimo.</span></label>
            ) : (
              <label style={labelStyle}>
                {requiredLabel("Status", true)}
                <select
                  required
                  value={formData[statusHeader] || ""}
                  onChange={(event) => handleChange(statusHeader, event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Selecione</option>
                  <option value="A">Ativo</option>
                  <option value="I">Inativo</option>
                </select>
              </label>
            ))}

            {statusAtualizacaoHeader && <label style={labelStyle}>Status atualização<input type="text" value={automaticStatus} readOnly style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.7 }} /></label>}
            {dataAtualizacaoHeader && <label style={labelStyle}>Data atualização<input type="text" value={formData[dataAtualizacaoHeader] || ""} readOnly style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.7 }} /></label>}
            {contadorHeader && <label style={labelStyle}>Contador atualização<input type="text" value={formData[contadorHeader] || ""} readOnly style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.7 }} /></label>}
            {responsavelAtualizacaoHeader && <label style={labelStyle}>Responsável atualização<input type="text" value={formData[responsavelAtualizacaoHeader] || ""} readOnly style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.7 }} /></label>}

            {obsHeader && <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>{requiredLabel("Observação", false)}<textarea value={formData[obsHeader] || ""} onChange={(event) => handleChange(obsHeader, event.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></label>}
          </div>

          <div className="mobile-modal-footer" style={{ padding: "16px 22px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {canTemporarilyReplace && <button type="button" onClick={() => setShowSubstitute(true)} disabled={saving || returning} style={{ padding: "10px 18px", backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: "8px", cursor: saving || returning ? "not-allowed" : "pointer", fontWeight: 700 }}>Substituir temporariamente</button>}
              {canFinalizeLoan && <button type="button" onClick={handleFinalizeLoan} disabled={saving || returning} style={{ padding: "10px 18px", backgroundColor: "rgba(16, 185, 129, 0.14)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.35)", borderRadius: "8px", cursor: saving || returning ? "not-allowed" : "pointer", fontWeight: 700 }}>{returning ? "Finalizando..." : "Finalizar empréstimo"}</button>}
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={onClose} disabled={saving || returning} style={{ padding: "10px 18px", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", cursor: saving || returning ? "not-allowed" : "pointer", fontWeight: 600 }}>Cancelar</button>
              <button type="submit" disabled={saving || returning} style={{ padding: "10px 20px", backgroundColor: "#3B82F6", color: "#FFFFFF", border: "none", borderRadius: "8px", cursor: saving || returning ? "not-allowed" : "pointer", fontWeight: 600 }}>{saving ? "Salvando..." : "Salvar alterações"}</button>
            </div>
          </div>
        </form>
      </div>

      <SubstituirMobileModal
        isOpen={showSubstitute}
        equipment={row}
        headers={headers}
        allRows={allRows}
        currentUserName={currentUserName}
        normalize={normalize}
        onClose={() => setShowSubstitute(false)}
        onSuccess={async () => {
          await Promise.resolve(onRefresh());
          setShowSubstitute(false);
          onClose();
        }}
      />
    </div>
  );
}
