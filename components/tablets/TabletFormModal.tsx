import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../auth/api";
import type { Permissions } from "../../auth/permissions";
import { useAppDialog } from "../../contexts/AppDialogContext";
import SubstituirMobileModal from "../SubstituirMobileModal";
import DevolverMobileModal from "../DevolverMobileModal";
import {
  TABLET_SHEETS,
  buttonStyle,
  cell,
  headerIndex,
  inputStyle,
  labelStyle,
  normalize,
  originalIndexOf,
  sortText,
  statusLabel,
} from "./tabletData";

interface TabletFormModalProps {
  isOpen: boolean;
  row: string[] | null; // null = novo tablet
  headers: string[];
  allRows: string[][];
  permissions: Permissions;
  currentUserName: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function TabletFormModal({
  isOpen,
  row,
  headers,
  allRows,
  permissions,
  currentUserName,
  onClose,
  onSaved,
}: TabletFormModalProps) {
  const { alert: showAlert } = useAppDialog();
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [showLoan, setShowLoan] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  const isNew = row === null;
  const idx = {
    setor: headerIndex(headers, "Setor"),
    quantidade: headerIndex(headers, "Quantidade"),
    tablet: headerIndex(headers, "Coletor", "Tablet"),
    sn: headerIndex(headers, "SN"),
    final: headerIndex(headers, "Final"),
    mac: headerIndex(headers, "MAC"),
    entregue: headerIndex(headers, "Entregue"),
    obs: headerIndex(headers, "Obs"),
    setorLocalizado: headerIndex(headers, "Setor localizado"),
    status: headerIndex(headers, "Status"),
    patrimonio: headerIndex(headers, "PATRIMONIO_REPROMAQ", "Patrimônio Repromaq", "Patrimonio Repromaq"),
  };

  const sectors = useMemo(
    () =>
      Array.from(
        new Set(
          allRows
            .flatMap((item) => [cell(item, idx.setor), cell(item, idx.setorLocalizado)])
            .filter(Boolean)
            .concat("TI-SUPORTE")
        )
      ).sort(sortText),
    [allRows, idx.setor, idx.setorLocalizado]
  );

  useEffect(() => {
    if (!isOpen) return;
    const initial: Record<number, string> = {};
    headers.forEach((_, index) => {
      initial[index] = row ? String(row[index] || "") : "";
    });
    if (isNew && idx.status !== -1) initial[idx.status] = "A";
    setValues(initial);
    setShowLoan(false);
    setShowReturn(false);
  }, [isOpen, row, headers]);

  if (!isOpen) return null;

  const value = (index: number) => (index === -1 ? "" : values[index] || "");
  const setValue = (index: number, next: string) => {
    if (index === -1) return;
    setValues((current) => ({ ...current, [index]: next }));
  };

  const originalStatus = row ? cell(row, idx.status).toUpperCase() : "";
  const currentStatus = value(idx.status).trim().toUpperCase();
  const currentSector = value(idx.setor).trim();
  const isOperationalStatus = originalStatus === "M" || originalStatus === "E";
  const canSave = isNew ? permissions.canCreateTablet : permissions.canEditTablet;
  const readOnly = !canSave || saving;
  const canChangeStatus = isNew || (permissions.canChangeTabletStatus && !isOperationalStatus);

  const canLend = !isNew && permissions.canCreateTabletLoan && originalStatus === "A" && normalize(currentSector) !== normalize("TI-SUPORTE");
  const canFinishLoan = !isNew && permissions.canReturnTabletLoan && originalStatus === "E" && normalize(currentSector) === normalize("TI-SUPORTE");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || saving) return;

    if (idx.tablet === -1 || idx.sn === -1 || idx.setor === -1 || idx.setorLocalizado === -1 || idx.status === -1) {
      await showAlert("A aba tbControleTablets precisa das colunas Coletor, SN, Setor, Setor localizado e Status.", { variant: "error" });
      return;
    }

    const tablet = value(idx.tablet).trim();
    const sn = value(idx.sn).trim();
    if (!tablet || !sn || !currentSector || !value(idx.setorLocalizado).trim() || !currentStatus) {
      await showAlert("Preencha os campos obrigatórios: Setor, Setor localizado, Tablet, SN e Status.", { variant: "warning" });
      return;
    }
    if (!/^\d+$/.test(sn)) {
      await showAlert("SN deve conter apenas números.", { variant: "warning" });
      return;
    }

    const currentRowIndex = row ? originalIndexOf(row) : null;
    const others = allRows.filter((item) => item !== row);
    if (others.some((item) => normalize(cell(item, idx.sn)) === normalize(sn))) {
      await showAlert(`Já existe outro tablet cadastrado com o SN "${sn}".`, { variant: "warning" });
      return;
    }
    if (currentStatus === "A" && others.some((item) => normalize(cell(item, idx.tablet)) === normalize(tablet) && cell(item, idx.status).toUpperCase() === "A")) {
      await showAlert(`Já existe outro tablet ATIVO com a identificação "${tablet}".`, { variant: "warning" });
      return;
    }
    if (!isNew && currentRowIndex === null) {
      await showAlert("Não foi possível identificar a linha original do tablet.", { variant: "error" });
      return;
    }

    const rowData = headers.map((_, index) => value(index).trim());
    if (isNew && idx.quantidade !== -1 && !rowData[idx.quantidade]) rowData[idx.quantidade] = "1";

    setSaving(true);
    try {
      const response = await apiFetch(isNew ? "/api/create" : "/api/update", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? { sheet: TABLET_SHEETS.control, rowData } : { sheet: TABLET_SHEETS.control, rowIndex: currentRowIndex, rowData }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Erro ao salvar o tablet.");
      await Promise.resolve(onSaved());
      onClose();
    } catch (error: any) {
      await showAlert("Erro ao salvar o tablet: " + (error?.message || "Erro desconhecido"), { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const textField = (index: number, label: string, required = false, numeric = false) =>
    index === -1 ? null : (
      <label style={labelStyle}>
        {label}{required ? " *" : ""}
        <input
          type="text"
          inputMode={numeric ? "numeric" : undefined}
          value={value(index)}
          onChange={(event) => setValue(index, numeric ? event.target.value.replace(/\D/g, "") : event.target.value)}
          disabled={readOnly}
          style={inputStyle}
        />
      </label>
    );

  const sectorField = (index: number, label: string, disabled = false) =>
    index === -1 ? null : (
      <label style={labelStyle}>
        {label} *
        <input
          type="text"
          list="tablet-sectors"
          value={value(index)}
          onChange={(event) => setValue(index, event.target.value)}
          disabled={readOnly || disabled}
          placeholder="Selecione ou digite"
          style={{ ...inputStyle, opacity: disabled ? 0.7 : 1 }}
        />
      </label>
    );

  return (
    <div className="mobile-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", zIndex: 1100 }}>
      <div className="mobile-modal-card" style={{ width: "100%", maxWidth: "820px", maxHeight: "90vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <form onSubmit={handleSubmit}>
          <div className="mobile-modal-header" style={{ padding: "20px 22px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "20px" }}>{isNew ? "Novo tablet" : canSave ? "Editar tablet" : "Detalhes do tablet"}</h2>
              <p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>{isNew ? "Cadastro no controle de tablets." : value(idx.tablet) || "Tablet"}</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontSize: "18px" }}>×</button>
          </div>

          <datalist id="tablet-sectors">
            {sectors.map((sector) => <option key={sector} value={sector} />)}
          </datalist>

          <div className="mobile-modal-grid" style={{ padding: "22px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px" }}>
            {sectorField(idx.setor, "Setor")}
            {sectorField(idx.setorLocalizado, "Setor localizado", isOperationalStatus)}
            {textField(idx.tablet, "Tablet", true)}
            {textField(idx.sn, "SN", true, true)}
            {textField(idx.final, "Final", false, true)}
            {textField(idx.mac, "MAC")}
            {textField(idx.patrimonio, "Patrimônio Repromaq")}
            {idx.entregue !== -1 && (
              <label style={labelStyle}>
                Entregue
                <input type="date" value={value(idx.entregue)} onChange={(event) => setValue(idx.entregue, event.target.value)} disabled={readOnly} style={inputStyle} />
              </label>
            )}
            {idx.status !== -1 && (isOperationalStatus || !canChangeStatus ? (
              <label style={labelStyle}>
                Status *
                <input type="text" value={statusLabel(originalStatus || currentStatus)} readOnly style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.75 }} />
                {isOperationalStatus && <span style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: 500 }}>Status controlado automaticamente pela rotina de empréstimo.</span>}
              </label>
            ) : (
              <label style={labelStyle}>
                Status *
                <select value={currentStatus} onChange={(event) => setValue(idx.status, event.target.value)} disabled={readOnly} style={inputStyle}>
                  <option value="A">Ativo</option>
                  <option value="I">Inativo</option>
                </select>
              </label>
            ))}
            {idx.obs !== -1 && (
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Observação
                <textarea value={value(idx.obs)} onChange={(event) => setValue(idx.obs, event.target.value)} disabled={readOnly} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </label>
            )}
          </div>

          <div className="mobile-modal-footer" style={{ padding: "16px 22px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {canLend && <button type="button" onClick={() => setShowLoan(true)} disabled={saving} style={{ ...buttonStyle("accent", "#F59E0B"), backgroundColor: "rgba(245, 158, 11, 0.14)", border: "1px solid rgba(245, 158, 11, 0.35)" }}>Substituir temporariamente</button>}
              {canFinishLoan && <button type="button" onClick={() => setShowReturn(true)} disabled={saving} style={{ ...buttonStyle("accent", "#10B981"), backgroundColor: "rgba(16, 185, 129, 0.14)", border: "1px solid rgba(16, 185, 129, 0.35)" }}>Finalizar empréstimo</button>}
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={onClose} disabled={saving} style={buttonStyle("secondary")}>{canSave ? "Cancelar" : "Fechar"}</button>
              {canSave && <button type="submit" disabled={saving} style={{ ...buttonStyle("primary"), opacity: saving ? 0.65 : 1, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Salvando..." : isNew ? "Cadastrar tablet" : "Salvar alterações"}</button>}
            </div>
          </div>
        </form>
      </div>

      {row && (
        <>
          <SubstituirMobileModal
            device="tablet"
            isOpen={showLoan}
            equipment={row}
            headers={headers}
            allRows={allRows}
            currentUserName={currentUserName}
            normalize={normalize}
            onClose={() => setShowLoan(false)}
            onSuccess={async () => {
              setShowLoan(false);
              await Promise.resolve(onSaved());
              onClose();
            }}
          />
          <DevolverMobileModal
            device="tablet"
            isOpen={showReturn}
            reserveCollector={cell(row, idx.tablet)}
            currentUserName={currentUserName}
            onClose={() => setShowReturn(false)}
            onSuccess={async () => {
              setShowReturn(false);
              await Promise.resolve(onSaved());
              onClose();
            }}
          />
        </>
      )}
    </div>
  );
}
