import { type FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../auth/api";
import { useAppDialog } from "../contexts/AppDialogContext";
import MobileLoanTermModal from "./MobileLoanTermModal";
import { loanRowToTermData, type MobileLoanTermData } from "./mobileLoanTermData";

interface DevolverMobileModalProps {
  isOpen: boolean;
  reserveCollector: string;
  currentUserName: string;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const normalize = (value: string) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const conditionOptions = [
  { value: "PERFEITO_ESTADO", label: "Em perfeito estado" },
  { value: "APRESENTANDO_DEFEITO", label: "Apresentando defeito" },
  { value: "FALTANDO_PECAS_ACESSORIOS", label: "Faltando peças/acessórios" },
];

export default function DevolverMobileModal({
  isOpen,
  reserveCollector,
  currentUserName,
  onClose,
  onSuccess,
}: DevolverMobileModalProps) {
  const { alert: showAlert } = useAppDialog();
  const [loan, setLoan] = useState<MobileLoanTermData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sameCollaborator, setSameCollaborator] = useState(true);
  const [name, setName] = useState("");
  const [registration, setRegistration] = useState("");
  const [role, setRole] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  const [observation, setObservation] = useState("");
  const [updateLocation, setUpdateLocation] = useState(true);
  const [returnSector, setReturnSector] = useState("");
  const [termData, setTermData] = useState<MobileLoanTermData | null>(null);

  useEffect(() => {
    if (!isOpen || !reserveCollector) return;
    let active = true;

    const loadLoan = async () => {
      setLoading(true);
      setLoan(null);
      setTermData(null);
      setConditions([]);
      setDetails("");
      setObservation("");
      setSameCollaborator(true);

      try {
        const response = await apiFetch("/api/data?sheet=tbEmprestimosMobiles");
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || "Erro ao carregar o empréstimo.");

        const values = Array.isArray(result) ? result : [];
        const headers = values[0] || [];
        const reserveIndex = headers.findIndex((header: string) => normalize(header) === "coletor_reserva");
        const statusIndex = headers.findIndex((header: string) => normalize(header) === "status_emprestimo");
        const matching = values.slice(1).filter((row: string[]) =>
          reserveIndex !== -1 &&
          statusIndex !== -1 &&
          normalize(row[reserveIndex] || "") === normalize(reserveCollector) &&
          normalize(row[statusIndex] || "") === "aberto"
        );

        if (matching.length !== 1) {
          throw new Error(matching.length === 0
            ? `Não existe empréstimo aberto para a reserva ${reserveCollector}.`
            : `Existe mais de um empréstimo aberto para a reserva ${reserveCollector}.`);
        }

        const loaded = loanRowToTermData(headers, matching[0]);
        if (!active) return;
        setLoan(loaded);
        setSameCollaborator(Boolean(loaded.loanCollaboratorName && loaded.loanCollaboratorRegistration && loaded.loanCollaboratorRole));
        setName(loaded.loanCollaboratorName);
        setRegistration(loaded.loanCollaboratorRegistration);
        setRole(loaded.loanCollaboratorRole);
        setReturnSector(loaded.destinationSector);
      } catch (error: any) {
        if (active) await showAlert(error.message || "Erro ao carregar o empréstimo.", { variant: "error" });
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadLoan();
    return () => { active = false; };
  }, [isOpen, reserveCollector, showAlert]);

  useEffect(() => {
    if (!sameCollaborator || !loan) return;
    setName(loan.loanCollaboratorName);
    setRegistration(loan.loanCollaboratorRegistration);
    setRole(loan.loanCollaboratorRole);
  }, [sameCollaborator, loan]);

  if (!isOpen) return null;

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    color: "var(--text-primary)",
    background: "var(--bg-input)",
    border: "1px solid var(--border-primary)",
    borderRadius: "8px",
    outline: "none",
  } as const;

  const toggleCondition = (value: string) => {
    setConditions((current) => {
      if (value === "PERFEITO_ESTADO") return current.includes(value) ? [] : [value];
      const withoutPerfect = current.filter((item) => item !== "PERFEITO_ESTADO");
      return withoutPerfect.includes(value)
        ? withoutPerfect.filter((item) => item !== value)
        : [...withoutPerfect, value];
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!loan) return;
    if (!name.trim() || !registration.trim() || !role.trim()) {
      await showAlert("Informe nome, matrícula e cargo do colaborador que está devolvendo.", { variant: "warning" });
      return;
    }
    if (conditions.length === 0) {
      await showAlert("Selecione ao menos uma condição de devolução.", { variant: "warning" });
      return;
    }
    if (conditions.some((item) => item !== "PERFEITO_ESTADO") && !details.trim()) {
      await showAlert("Descreva o defeito ou as peças/acessórios faltantes.", { variant: "warning" });
      return;
    }
    if (updateLocation && !returnSector.trim()) {
      await showAlert("Informe o setor onde o equipamento original ficará localizado.", { variant: "warning" });
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/api/mobiles/loan-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserveCollector,
          observation: observation.trim(),
          updateLocation,
          returnSector: returnSector.trim(),
          returnCollaboratorName: name.trim(),
          returnCollaboratorRegistration: registration.trim(),
          returnCollaboratorRole: role.trim(),
          returnCondition: conditions,
          returnDetails: details.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Erro ao finalizar o empréstimo.");
      setTermData(result.termData as MobileLoanTermData);
    } catch (error: any) {
      await showAlert(error.message || "Erro ao finalizar o empréstimo.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mobile-modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(15, 23, 42, 0.72)", backdropFilter: "blur(8px)" }}>
      <div className="mobile-modal-card" style={{ width: "min(720px, 100%)", maxHeight: "92vh", overflowY: "auto", color: "var(--text-primary)", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "14px" }}>
        <form onSubmit={handleSubmit}>
          <div className="mobile-modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "20px 22px", borderBottom: "1px solid var(--border-primary)" }}>
            <div><h2 style={{ margin: 0, fontSize: "20px" }}>Devolução de equipamento</h2><p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>Reserva {reserveCollector} · Técnico: {currentUserName}</p></div>
            <button type="button" onClick={onClose} disabled={saving} style={{ width: "34px", height: "34px", color: "var(--text-primary)", background: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", fontSize: "18px" }}>×</button>
          </div>

          {loading ? <div style={{ padding: "36px", color: "var(--text-muted)", textAlign: "center" }}>Carregando dados do empréstimo...</div> : loan ? (
            <div className="mobile-modal-grid" style={{ display: "grid", gap: "16px", padding: "22px" }}>
              <div style={{ padding: "13px", color: "var(--text-secondary)", background: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: "9px", fontSize: "12px", lineHeight: 1.55 }}>
                <strong style={{ color: "var(--text-primary)" }}>Empréstimo {loan.loanId}</strong><br />
                Reserva: {loan.reserveCollector} · SN {loan.reserveSerial || "-"}<br />
                Substituído: {loan.originalCollector} · Setor informado: {loan.destinationSector || "-"}
              </div>

              <section className="mobile-loan-form-section">
                <label style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", fontWeight: 700 }}>
                  <input type="checkbox" checked={sameCollaborator} onChange={(event) => setSameCollaborator(event.target.checked)} />
                  Mesmo colaborador que recebeu o equipamento
                </label>
                <div className="mobile-loan-form-grid">
                  <label>Nome completo *<input type="text" value={name} readOnly={sameCollaborator} onChange={(event) => setName(event.target.value)} style={{ ...inputStyle, opacity: sameCollaborator ? 0.75 : 1 }} /></label>
                  <label>Matrícula *<input type="text" inputMode="numeric" value={registration} readOnly={sameCollaborator} onChange={(event) => setRegistration(event.target.value)} style={{ ...inputStyle, opacity: sameCollaborator ? 0.75 : 1 }} /></label>
                  <label>Cargo *<input type="text" value={role} readOnly={sameCollaborator} onChange={(event) => setRole(event.target.value)} style={{ ...inputStyle, opacity: sameCollaborator ? 0.75 : 1 }} /></label>
                </div>
              </section>

              <section className="mobile-loan-form-section">
                <div className="mobile-loan-form-section-title"><strong>Condição na devolução *</strong><span>Selecione a situação constatada no recebimento.</span></div>
                <div style={{ display: "grid", gap: "9px" }}>
                  {conditionOptions.map((option) => <label key={option.value} style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px" }}><input type="checkbox" checked={conditions.includes(option.value)} onChange={() => toggleCondition(option.value)} />{option.label}</label>)}
                </div>
                <label>Detalhamento{conditions.some((item) => item !== "PERFEITO_ESTADO") ? " *" : ""}<textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Descreva defeitos ou acessórios faltantes" style={{ ...inputStyle, resize: "vertical" }} /></label>
              </section>

              <section className="mobile-loan-form-section">
                <label style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", fontWeight: 700 }}><input type="checkbox" checked={updateLocation} onChange={(event) => setUpdateLocation(event.target.checked)} />Atualizar setor de localização na devolução</label>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "11px" }}>A reserva retornará para TI-SUPORTE e o equipamento original ficará no setor informado abaixo.</p>
                <label>Setor onde o equipamento original ficará localizado{updateLocation ? " *" : ""}<input type="text" value={returnSector} disabled={!updateLocation} onChange={(event) => setReturnSector(event.target.value)} style={{ ...inputStyle, opacity: updateLocation ? 1 : 0.6 }} /></label>
              </section>

              <label>Observação da devolução<textarea rows={3} value={observation} onChange={(event) => setObservation(event.target.value)} style={{ ...inputStyle, resize: "vertical" }} /></label>
            </div>
          ) : null}

          <div className="mobile-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", padding: "16px 22px", borderTop: "1px solid var(--border-primary)" }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ padding: "10px 18px", color: "var(--text-primary)", background: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", fontWeight: 600 }}>Cancelar</button>
            <button type="submit" disabled={saving || loading || !loan} style={{ padding: "10px 18px", color: "#fff", background: "#059669", border: 0, borderRadius: "8px", fontWeight: 700, opacity: saving || loading || !loan ? 0.65 : 1 }}>{saving ? "Finalizando..." : "Finalizar e gerar termo"}</button>
          </div>
        </form>
      </div>

      <MobileLoanTermModal isOpen={termData !== null} type="return" data={termData} onClose={async () => {
        setTermData(null);
        onClose();
        await onSuccess();
      }} />
    </div>
  );
}
