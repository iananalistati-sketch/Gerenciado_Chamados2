import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../auth/api";
import { useAppDialog } from "../contexts/AppDialogContext";
import type { AdminRollback } from "./adminProcess";

interface AdminProcessModalProps {
  isOpen: boolean;
  title: string;
  sheet: string;
  headers: string[];
  row: string[] | null;
  rollback?: AdminRollback | null;
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

// Edição e rollback exclusivos do Administrador. Os registros são sobrescritos e cada ação
// fica registrada em tbAuditoriaMobiles pelo servidor.
export default function AdminProcessModal({ isOpen, title, sheet, headers, row, rollback, onClose, onDone }: AdminProcessModalProps) {
  const { alert: showAlert, confirm: showConfirm } = useAppDialog();
  const [values, setValues] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const original = useMemo(() => {
    const base = (row || []).map((value) => String(value ?? ""));
    while (base.length < headers.length) base.push("");
    return base;
  }, [row, headers]);

  useEffect(() => {
    if (!isOpen) return;
    setValues(original);
    setReason("");
  }, [isOpen, original]);

  if (!isOpen || !row) return null;

  const rowIndex = (row as any)._originalIndex as number | undefined;
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
      body: JSON.stringify({ ...payload, reason: reason.trim() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Erro na ação administrativa.");
    return result;
  };

  const requireReason = async () => {
    if (reason.trim().length >= 5) return true;
    await showAlert("Informe o motivo da alteração (mínimo de 5 caracteres). Ele fica registrado na auditoria.", { variant: "warning" });
    return false;
  };

  const handleSave = async () => {
    if (saving) return;
    if (changedCount === 0) {
      await showAlert("Nenhum campo foi alterado.", { variant: "warning" });
      return;
    }
    if (!(await requireReason())) return;
    if (typeof rowIndex !== "number") {
      await showAlert("Não foi possível identificar a linha do registro.", { variant: "error" });
      return;
    }
    const confirmed = await showConfirm(`Sobrescrever ${changedCount} campo(s) deste registro?\n\nA alteração fica registrada na auditoria.`, {
      title: "Confirmar edição administrativa",
      variant: "warning",
      confirmLabel: "Salvar",
      cancelLabel: "Voltar",
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      await send({ adminAction: "edit", sheet, rowIndex, expected: original, values });
      await showAlert("Registro atualizado e auditoria registrada.", { variant: "success" });
      await Promise.resolve(onDone());
      onClose();
    } catch (error: any) {
      await showAlert(error?.message || "Erro ao salvar.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async () => {
    if (saving || !rollback) return;
    if (changedCount > 0) {
      await showAlert("Há campos editados não salvos. Salve ou descarte a edição antes de desfazer a etapa.", { variant: "warning" });
      return;
    }
    if (!(await requireReason())) return;
    const confirmed = await showConfirm(`${rollback.description}\n\nDeseja continuar?`, {
      title: "Desfazer etapa (rollback)",
      variant: "warning",
      confirmLabel: "Desfazer etapa",
      cancelLabel: "Voltar",
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      const result = await send({ adminAction: "rollback", process: rollback.process, id: rollback.id });
      await showAlert(`${result?.description || "Etapa desfeita"}. Auditoria registrada.`, { variant: "success" });
      await Promise.resolve(onDone());
      onClose();
    } catch (error: any) {
      await showAlert(error?.message || "Erro ao desfazer a etapa.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mobile-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", zIndex: 1300 }}>
      <div className="mobile-modal-card" style={{ width: "100%", maxWidth: "900px", maxHeight: "92vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)", border: "1px solid rgba(220, 38, 38, 0.45)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div className="mobile-modal-header" style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "19px" }}>Modo Administrador · {title}</h2>
            <p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>Aba {sheet}{typeof rowIndex === "number" ? ` · linha ${rowIndex}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontSize: "18px" }}>×</button>
        </div>

        <div style={{ padding: "18px 22px", display: "grid", gap: "16px" }}>
          <div style={{ padding: "11px 13px", borderRadius: "9px", backgroundColor: "rgba(220, 38, 38, 0.10)", border: "1px solid rgba(220, 38, 38, 0.35)", color: "#DC2626", fontSize: "12px", lineHeight: 1.5 }}>
            Exceção exclusiva do Administrador: as regras do processo não são aplicadas. O registro é sobrescrito com os novos valores e a ação fica registrada na auditoria (quem, quando, antes → depois e motivo).
          </div>

          <label style={{ display: "grid", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>
            Motivo da alteração *
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="Ex.: equipamento informado errado no empréstimo" style={{ ...inputStyle, resize: "vertical" }} />
          </label>

          {rollback && (
            <section className="mobile-loan-form-section">
              <div className="mobile-loan-form-section-title">
                <strong>Desfazer etapa (rollback)</strong>
                <span>{rollback.description}</span>
              </div>
              <div>
                <button type="button" onClick={handleRollback} disabled={saving} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.45)", backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#F59E0B", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                  ↶ Desfazer etapa
                </button>
              </div>
            </section>
          )}

          <section className="mobile-loan-form-section">
            <div className="mobile-loan-form-section-title">
              <strong>Editar registro</strong>
              <span>Todos os campos podem ser alterados, inclusive responsáveis, datas, status e equipamentos. {changedCount > 0 ? `${changedCount} campo(s) alterado(s).` : ""}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              {headers.map((_, index) => (
                <label key={index} style={{ display: "grid", gap: "5px", color: changed[index] ? "#F59E0B" : "var(--text-secondary)", fontSize: "11px", fontWeight: 600 }}>
                  {labels[index]}{changed[index] ? " • alterado" : ""}
                  <input
                    type="text"
                    value={values[index] ?? ""}
                    onChange={(event) => setValues((current) => current.map((value, i) => (i === index ? event.target.value : value)))}
                    disabled={saving}
                    style={{ ...inputStyle, borderColor: changed[index] ? "#F59E0B" : "var(--border-primary)" }}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="mobile-modal-footer" style={{ padding: "14px 22px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setValues(original)} disabled={saving || changedCount === 0} style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" }}>Descartar edição</button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" }}>Fechar</button>
            <button type="button" onClick={handleSave} disabled={saving || changedCount === 0} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", backgroundColor: "#DC2626", color: "#FFFFFF", fontWeight: 700, cursor: saving || changedCount === 0 ? "not-allowed" : "pointer", opacity: saving || changedCount === 0 ? 0.6 : 1 }}>
              {saving ? "Salvando..." : "Salvar alterações (admin)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
