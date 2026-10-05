import React, { useEffect, useState } from "react";
import { apiFetch } from "../auth/api";
import { useAppDialog } from "../contexts/AppDialogContext";
import ExternalMaintenanceTermModal from "./ExternalMaintenanceTermModal";
import {
  ACCESSORY_OPTIONS,
  apiRecordToTermData,
  type ExternalMaintenanceTermData,
} from "./externalMaintenanceData";

interface ManutencaoExternaModalProps {
  isOpen: boolean;
  equipment: string[] | null;
  headers: string[];
  currentUserName: string;
  normalize: (value: string) => string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export default function ManutencaoExternaModal({
  isOpen,
  equipment,
  headers,
  currentUserName,
  normalize,
  onClose,
  onSuccess,
}: ManutencaoExternaModalProps) {
  const { alert: showAlert } = useAppDialog();
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryRegistration, setDeliveryRegistration] = useState("");
  const [deliveryRole, setDeliveryRole] = useState("");
  const [serviceOrder, setServiceOrder] = useState("");
  const [brand, setBrand] = useState("Urovo");
  const [model, setModel] = useState("DT50");
  const [reportedDefect, setReportedDefect] = useState("");
  const [accessories, setAccessories] = useState<string[]>([]);
  const [otherAccessories, setOtherAccessories] = useState("");
  const [observation, setObservation] = useState("");
  const [termData, setTermData] = useState<ExternalMaintenanceTermData | null>(null);
  const [saving, setSaving] = useState(false);

  const getIndex = (...names: string[]) =>
    headers.findIndex((header) => names.some((name) => normalize(header) === normalize(name)));

  const valueAt = (index: number) => (equipment && index !== -1 ? String(equipment[index] || "").trim() : "");
  const collector = valueAt(getIndex("Coletor"));
  const serial = valueAt(getIndex("SN"));
  const sector = valueAt(getIndex("Setor"));
  const location = valueAt(getIndex("Setor localizado"));

  useEffect(() => {
    if (!isOpen || !equipment) return;
    setDeliveryName("");
    setDeliveryRegistration("");
    setDeliveryRole("");
    setServiceOrder("");
    setBrand("Urovo");
    setModel("DT50");
    setReportedDefect("");
    setAccessories([]);
    setOtherAccessories("");
    setObservation("");
    setTermData(null);
  }, [isOpen, equipment]);

  if (!isOpen || !equipment) return null;

  const toggleAccessory = (key: string) =>
    setAccessories((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    if (!deliveryName.trim() || !deliveryRegistration.trim() || !deliveryRole.trim()) {
      await showAlert("Informe nome, matrícula e cargo do colaborador que está entregando o equipamento.", { variant: "warning" });
      return;
    }
    if (!brand.trim() || !model.trim()) {
      await showAlert("Informe marca e modelo do equipamento.", { variant: "warning" });
      return;
    }
    if (!reportedDefect.trim()) {
      await showAlert("Descreva o defeito relatado.", { variant: "warning" });
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/api/mobiles/loan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: "external_maintenance",
          collector,
          serial,
          deliveryName: deliveryName.trim(),
          deliveryRegistration: deliveryRegistration.trim(),
          deliveryRole: deliveryRole.trim(),
          serviceOrder: serviceOrder.trim(),
          brand: brand.trim(),
          model: model.trim(),
          reportedDefect: reportedDefect.trim(),
          accessories,
          otherAccessories: otherAccessories.trim(),
          observation: observation.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Erro ao registrar envio para manutenção externa.");
      setTermData(apiRecordToTermData(result.termData || {}));
    } catch (error: any) {
      await showAlert("Erro ao registrar envio para manutenção externa: " + (error?.message || "Erro desconhecido"), { variant: "error" });
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

  return (
    <div className="mobile-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", zIndex: 1200 }}>
      <div className="mobile-modal-card" style={{ width: "100%", maxWidth: "660px", maxHeight: "92vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <form onSubmit={handleSubmit}>
          <div className="mobile-modal-header" style={{ padding: "20px 22px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "20px" }}>Enviar para manutenção externa</h2>
              <p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>
                Registra o recebimento do equipamento pela TI, sem empréstimo de reserva, e gera o termo de recebimento.
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer", fontSize: "18px" }}>×</button>
          </div>

          <div className="mobile-modal-grid" style={{ padding: "22px", display: "grid", gap: "16px" }}>
            <div style={{ padding: "14px", border: "1px solid var(--border-primary)", borderRadius: "10px", backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--text-primary)" }}>Equipamento enviado</strong>
              <br />
              Coletor: {collector || "-"} · SN: {serial || "-"}
              <br />
              Setor: {sector || "-"} · Localização atual: {location || "-"}
              <br />
              Técnico responsável pelo recebimento: {currentUserName || "-"}
            </div>

            <section className="mobile-loan-form-section">
              <div className="mobile-loan-form-section-title">
                <strong>Colaborador que está entregando o equipamento</strong>
                <span>Estes dados serão usados no termo de recebimento.</span>
              </div>
              <div className="mobile-loan-form-grid">
                <label style={labelStyle}>Nome completo *<input type="text" value={deliveryName} onChange={(event) => setDeliveryName(event.target.value)} style={inputStyle} /></label>
                <label style={labelStyle}>Matrícula *<input type="text" inputMode="numeric" value={deliveryRegistration} onChange={(event) => setDeliveryRegistration(event.target.value)} style={inputStyle} /></label>
                <label style={labelStyle}>Cargo *<input type="text" value={deliveryRole} onChange={(event) => setDeliveryRole(event.target.value)} style={inputStyle} /></label>
                <label style={labelStyle}>Ordem de Serviço<input type="text" value={serviceOrder} onChange={(event) => setServiceOrder(event.target.value)} placeholder="Opcional" style={inputStyle} /></label>
              </div>
            </section>

            <section className="mobile-loan-form-section">
              <div className="mobile-loan-form-section-title">
                <strong>Identificação para o termo</strong>
                <span>Os valores sugeridos podem ser alterados antes do registro.</span>
              </div>
              <div className="mobile-loan-form-grid">
                <label style={labelStyle}>Marca *<input type="text" value={brand} onChange={(event) => setBrand(event.target.value)} style={inputStyle} /></label>
                <label style={labelStyle}>Modelo *<input type="text" value={model} onChange={(event) => setModel(event.target.value)} style={inputStyle} /></label>
              </div>
            </section>

            <label style={labelStyle}>
              Defeito relatado *
              <textarea value={reportedDefect} onChange={(event) => setReportedDefect(event.target.value)} rows={3} placeholder="Ex.: não liga, tela quebrada, leitor não lê código de barras" style={{ ...inputStyle, resize: "vertical" }} />
            </label>

            <section className="mobile-loan-form-section">
              <div className="mobile-loan-form-section-title">
                <strong>Acessórios entregues</strong>
                <span>Marque somente o que foi entregue junto com o equipamento.</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px" }}>
                {ACCESSORY_OPTIONS.map((option) => (
                  <label key={option.key} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontSize: "13px", cursor: "pointer" }}>
                    <input type="checkbox" checked={accessories.includes(option.key)} onChange={() => toggleAccessory(option.key)} />
                    {option.label}
                  </label>
                ))}
              </div>
              <label style={{ ...labelStyle, marginTop: "10px" }}>
                Outros acessórios
                <input type="text" value={otherAccessories} onChange={(event) => setOtherAccessories(event.target.value)} placeholder="Opcional" style={inputStyle} />
              </label>
            </section>

            <label style={labelStyle}>
              Observação
              <textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </label>

            <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.35)", color: "#F59E0B", fontSize: "12px", lineHeight: 1.5 }}>
              Ao registrar, o equipamento ficará com Status <strong>Manutenção</strong> e Setor localizado <strong>MANUTENÇÃO EXTERNA</strong> até o registro do retorno.
            </div>
          </div>

          <div className="mobile-modal-footer" style={{ padding: "16px 22px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ padding: "10px 18px", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600 }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ padding: "10px 20px", backgroundColor: "#8B5CF6", color: "#FFFFFF", border: "none", borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, opacity: saving ? 0.65 : 1 }}>
              {saving ? "Registrando..." : "Registrar e gerar termo"}
            </button>
          </div>
        </form>
      </div>
      <ExternalMaintenanceTermModal
        isOpen={termData !== null}
        type="receipt"
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
