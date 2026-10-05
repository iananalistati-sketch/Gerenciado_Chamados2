import React, { useEffect, useState } from "react";
import { apiFetch } from "../auth/api";
import { useAppDialog } from "../contexts/AppDialogContext";
import ExternalMaintenanceTermModal from "./ExternalMaintenanceTermModal";
import {
  EXTERNAL_MAINTENANCE_SHEET,
  apiRecordToTermData,
  maintenanceRowToTermData,
  type ExternalMaintenanceTermData,
} from "./externalMaintenanceData";

interface RetornoManutencaoExternaModalProps {
  isOpen: boolean;
  record?: ExternalMaintenanceTermData | null;
  collector?: string;
  currentUserName: string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export default function RetornoManutencaoExternaModal({
  isOpen,
  record,
  collector,
  currentUserName,
  onClose,
  onSuccess,
}: RetornoManutencaoExternaModalProps) {
  const { alert: showAlert } = useAppDialog();
  const [openRecord, setOpenRecord] = useState<ExternalMaintenanceTermData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [receiverRegistration, setReceiverRegistration] = useState("");
  const [receiverRole, setReceiverRole] = useState("");
  const [returnSector, setReturnSector] = useState("");
  const [serviceDone, setServiceDone] = useState("");
  const [observation, setObservation] = useState("");
  const [termData, setTermData] = useState<ExternalMaintenanceTermData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setReceiverName("");
    setReceiverRegistration("");
    setReceiverRole("");
    setServiceDone("");
    setObservation("");
    setTermData(null);
    setLoadError(null);

    if (record) {
      setOpenRecord(record);
      setReturnSector(record.originSector);
      return;
    }

    let cancelled = false;
    setOpenRecord(null);
    setReturnSector("");
    setLoading(true);
    (async () => {
      try {
        const response = await apiFetch(`/api/data?sheet=${EXTERNAL_MAINTENANCE_SHEET}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || "Erro ao carregar manutenções externas.");
        const values: string[][] = Array.isArray(result) ? result : [];
        const headers = values[0] || [];
        const found = values
          .slice(1)
          .map((row) => maintenanceRowToTermData(headers, row))
          .filter((item) => normalize(item.status) === "aberta" && normalize(item.collector) === normalize(collector || ""));
        if (cancelled) return;
        if (found.length !== 1) {
          setLoadError(found.length === 0
            ? `Não foi encontrada manutenção externa ABERTA para o Coletor "${collector}".`
            : `Existe mais de uma manutenção externa ABERTA para o Coletor "${collector}".`);
          return;
        }
        setOpenRecord(found[0]);
        setReturnSector(found[0].originSector);
      } catch (error: any) {
        if (!cancelled) setLoadError(error?.message || "Erro ao carregar manutenções externas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, record, collector]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !openRecord) return;

    if (!receiverName.trim() || !receiverRegistration.trim() || !receiverRole.trim()) {
      await showAlert("Informe nome, matrícula e cargo do colaborador que está recebendo o equipamento.", { variant: "warning" });
      return;
    }
    if (!returnSector.trim()) {
      await showAlert("Informe o setor que receberá o equipamento.", { variant: "warning" });
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/api/mobiles/loan-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: "external_maintenance",
          maintenanceId: openRecord.maintenanceId,
          receiverName: receiverName.trim(),
          receiverRegistration: receiverRegistration.trim(),
          receiverRole: receiverRole.trim(),
          returnSector: returnSector.trim(),
          serviceDone: serviceDone.trim(),
          observation: observation.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Erro ao registrar retorno da manutenção externa.");
      setTermData(apiRecordToTermData(result.termData || {}));
    } catch (error: any) {
      await showAlert("Erro ao registrar retorno: " + (error?.message || "Erro desconhecido"), { variant: "error" });
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
  const labelStyle: React.CSSProperties = { display: "grid", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 };
  const blocked = saving || loading || !openRecord;

  return (
    <div className="mobile-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", zIndex: 1200 }}>
      <div className="mobile-modal-card" style={{ width: "100%", maxWidth: "620px", maxHeight: "92vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <form onSubmit={handleSubmit}>
          <div className="mobile-modal-header" style={{ padding: "20px 22px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "20px" }}>Retorno da manutenção externa</h2>
              <p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>Reativa o equipamento no setor e gera o termo de devolução.</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer", fontSize: "18px" }}>×</button>
          </div>

          <div className="mobile-modal-grid" style={{ padding: "22px", display: "grid", gap: "16px" }}>
            {loading && <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Carregando manutenção externa...</div>}
            {loadError && <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#EF4444", fontSize: "12px" }}>{loadError}</div>}

            {openRecord && (
              <>
                <div style={{ padding: "14px", border: "1px solid var(--border-primary)", borderRadius: "10px", backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--text-primary)" }}>{openRecord.collector || "-"}</strong> · SN {openRecord.serial || "-"}
                  <br />
                  Protocolo: {openRecord.maintenanceId} · Enviado em {openRecord.sendDate ? openRecord.sendDate.slice(0, 10).split("-").reverse().join("/") : "-"}
                  <br />
                  Defeito relatado: {openRecord.reportedDefect || "-"}
                  <br />
                  Técnico responsável pela entrega: {currentUserName || "-"}
                </div>

                <section className="mobile-loan-form-section">
                  <div className="mobile-loan-form-section-title">
                    <strong>Colaborador que está recebendo o equipamento</strong>
                    <span>Estes dados serão usados no termo de devolução.</span>
                  </div>
                  <div className="mobile-loan-form-grid">
                    <label style={labelStyle}>Nome completo *<input type="text" value={receiverName} onChange={(event) => setReceiverName(event.target.value)} style={inputStyle} /></label>
                    <label style={labelStyle}>Matrícula *<input type="text" inputMode="numeric" value={receiverRegistration} onChange={(event) => setReceiverRegistration(event.target.value)} style={inputStyle} /></label>
                    <label style={labelStyle}>Cargo *<input type="text" value={receiverRole} onChange={(event) => setReceiverRole(event.target.value)} style={inputStyle} /></label>
                    <label style={labelStyle}>Setor que receberá *<input type="text" value={returnSector} onChange={(event) => setReturnSector(event.target.value)} style={inputStyle} /></label>
                  </div>
                </section>

                <label style={labelStyle}>
                  Serviço realizado
                  <textarea value={serviceDone} onChange={(event) => setServiceDone(event.target.value)} rows={3} placeholder="Ex.: substituição da tela; troca do conector de carga" style={{ ...inputStyle, resize: "vertical" }} />
                </label>
                <label style={labelStyle}>
                  Observação
                  <textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                </label>
              </>
            )}
          </div>

          <div className="mobile-modal-footer" style={{ padding: "16px 22px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ padding: "10px 18px", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600 }}>Cancelar</button>
            <button type="submit" disabled={blocked} style={{ padding: "10px 20px", backgroundColor: "#10B981", color: "#FFFFFF", border: "none", borderRadius: "8px", cursor: blocked ? "not-allowed" : "pointer", fontWeight: 700, opacity: blocked ? 0.65 : 1 }}>
              {saving ? "Registrando..." : "Registrar retorno e gerar termo"}
            </button>
          </div>
        </form>
      </div>
      <ExternalMaintenanceTermModal
        isOpen={termData !== null}
        type="return"
        data={termData}
        onClose={async () => {
          setTermData(null);
          onClose();
          await onSuccess();
        }}
      />
    </div>
  );
}
