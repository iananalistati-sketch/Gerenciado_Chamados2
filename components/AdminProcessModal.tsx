import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../auth/api";
import { useAppDialog } from "../contexts/AppDialogContext";
import { PROCESS_CONFIG, isOpenRecord, isProtectedField, rowValue, type AdminProcess } from "./adminProcess";

interface AdminProcessModalProps {
  process: AdminProcess;
  headers: string[];
  row: string[] | null;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 11px",
  backgroundColor: "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-primary)",
  borderRadius: "8px",
  fontSize: "13px",
  outline: "none",
};

// Ações exclusivas do Administrador no histórico: processo em aberto → modificar qualquer etapa;
// processo finalizado → excluir. O servidor registra cada ação em tbAuditoriaMobiles.
export default function AdminProcessModal({ process, headers, row, onClose, onDone }: AdminProcessModalProps) {
  const { alert: showAlert, confirm: showConfirm } = useAppDialog();
  const [values, setValues] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const config = PROCESS_CONFIG[process];

  const original = useMemo(() => {
    const base = (row || []).map((value) => String(value ?? ""));
    while (base.length < headers.length) base.push("");
    return base;
  }, [row, headers]);

  useEffect(() => {
    setValues(original);
    setReason("");
  }, [original]);

  if (!row) return null;

  const id = rowValue(headers, row, config.idColumn);
  const editable = isOpenRecord(process, headers, row);
  const status = config.statusColumn ? rowValue(headers, row, config.statusColumn) : "";
  const labels = headers.map((header, index) => {
    const name = header || `Coluna ${index + 1}`;
    const repeated = headers.slice(0, index).filter((other) => other === header).length;
    return repeated > 0 ? `${name} (${repeated + 1})` : name;
  });
  const changed = values.map((value, index) => value.trim() !== (original[index] || "").trim());
  const changedCount = changed.filter(Boolean).length;

  const send = async (payload: Record<string, unknown>) => {
    const response = await apiFetch("/api/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, process, id, reason: reason.trim() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Erro na ação administrativa.");
    return result;
  };

  const requireReason = async () => {
    if (reason.trim().length >= 5) return true;
    await showAlert("Informe o motivo (mínimo de 5 caracteres). Ele fica registrado no banco.", { variant: "warning" });
    return false;
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try {
      await action();
      await showAlert(success, { variant: "success" });
      await Promise.resolve(onDone());
      onClose();
    } catch (error: any) {
      await showAlert(error?.message || "Erro na ação administrativa.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (changedCount === 0) {
      await showAlert("Nenhum campo foi alterado.", { variant: "warning" });
      return;
    }
    if (!(await requireReason())) return;
    const confirmed = await showConfirm(
      `Modificar ${changedCount} campo(s) de ${id}?\n\nSe o coletor ou o setor mudar, o cadastro dos coletores envolvidos é ajustado. O registro passa a exibir "Modificada".`,
      { title: "Confirmar modificação", variant: "warning", confirmLabel: "Modificar", cancelLabel: "Voltar" }
    );
    if (!confirmed) return;
    await run(() => send({ adminAction: "edit", expected: original, values }), "Registro modificado.");
  };

  const handleDelete = async () => {
    if (saving) return;
    if (!(await requireReason())) return;
    const confirmed = await showConfirm(`Excluir ${config.title.toLowerCase()} ${id} do histórico?\n\nA exclusão fica registrada apenas no banco, com a cópia dos dados.`, {
      title: "Confirmar exclusão",
      variant: "error",
      confirmLabel: "Excluir",
      cancelLabel: "Voltar",
    });
    if (!confirmed) return;
    await run(() => send({ adminAction: "delete" }), "Registro excluído do histórico.");
  };

  const buttonStyle: React.CSSProperties = { padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" };

  return (
    <div className="mobile-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", zIndex: 1300 }}>
      <div className="mobile-modal-card" style={{ width: "100%", maxWidth: editable ? "900px" : "560px", maxHeight: "92vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)", border: "1px solid rgba(220, 38, 38, 0.45)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div className="mobile-modal-header" style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "19px" }}>
              Administrador · {editable ? "Modificar" : "Excluir"} {config.title.toLowerCase()}
            </h2>
            <p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>{id}{status ? ` · ${status}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontSize: "18px" }}>×</button>
        </div>

        <div style={{ padding: "18px 22px", display: "grid", gap: "16px" }}>
          <div style={{ padding: "11px 13px", borderRadius: "9px", backgroundColor: "rgba(220, 38, 38, 0.10)", border: "1px solid rgba(220, 38, 38, 0.35)", color: "#DC2626", fontSize: "12px", lineHeight: 1.5 }}>
            {editable
              ? "Processo em aberto: qualquer campo pode ser modificado, sem as regras normais do processo. O registro é substituído pelos novos dados e passa a exibir \"Modificada\". Os detalhes (quem, quando, antes → depois e motivo) ficam registrados somente no banco."
              : "Processo finalizado: o registro pode ser excluído do histórico. A exclusão fica registrada somente no banco, com a cópia integral dos dados."}
          </div>

          <label style={{ display: "grid", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>
            Motivo *
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder={editable ? "Ex.: coletor reserva informado errado" : "Ex.: registro de teste"} style={{ ...inputStyle, resize: "vertical" }} />
          </label>

          {editable && (
            <section className="mobile-loan-form-section">
              <div className="mobile-loan-form-section-title">
                <strong>Dados do processo</strong>
                <span>ID e status não são alterados por aqui. {changedCount > 0 ? `${changedCount} campo(s) alterado(s).` : ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                {headers.map((header, index) => {
                  const locked = isProtectedField(process, header);
                  return (
                    <label key={index} style={{ display: "grid", gap: "5px", color: changed[index] ? "#F59E0B" : "var(--text-secondary)", fontSize: "11px", fontWeight: 600 }}>
                      {labels[index]}{changed[index] ? " • alterado" : ""}
                      <input
                        type="text"
                        value={values[index] ?? ""}
                        onChange={(event) => setValues((current) => current.map((value, i) => (i === index ? event.target.value : value)))}
                        disabled={saving || locked}
                        style={{ ...inputStyle, borderColor: changed[index] ? "#F59E0B" : "var(--border-primary)", opacity: locked ? 0.6 : 1 }}
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="mobile-modal-footer" style={{ padding: "14px 22px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          {editable ? (
            <button type="button" onClick={() => setValues(original)} disabled={saving || changedCount === 0} style={buttonStyle}>Descartar alterações</button>
          ) : <span />}
          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" onClick={onClose} disabled={saving} style={buttonStyle}>Fechar</button>
            {editable ? (
              <button type="button" onClick={handleSave} disabled={saving || changedCount === 0} style={{ ...buttonStyle, border: "none", backgroundColor: "#DC2626", color: "#FFFFFF", fontWeight: 700, cursor: saving || changedCount === 0 ? "not-allowed" : "pointer", opacity: saving || changedCount === 0 ? 0.6 : 1 }}>
                {saving ? "Salvando..." : "Salvar modificação"}
              </button>
            ) : (
              <button type="button" onClick={handleDelete} disabled={saving} style={{ ...buttonStyle, border: "none", backgroundColor: "#DC2626", color: "#FFFFFF", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Excluindo..." : "Excluir do histórico"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
