import React, { useMemo, useState } from "react";
import { apiFetch } from "../auth/api";
import { useAppDialog } from "../contexts/AppDialogContext";

interface MobileMaintenancePanelProps {
  data: string[][];
  canEdit: boolean;
  onRefresh: () => void | Promise<void>;
}

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export default function MobileMaintenancePanel({
  data,
  canEdit,
  onRefresh,
}: MobileMaintenancePanelProps) {
  const { confirm: showConfirm, alert: showAlert } = useAppDialog();
  const [search, setSearch] = useState("");
  const [returningCollector, setReturningCollector] = useState("");

  const headers = data[0] || [];
  const rows = data.slice(1);

  const getColumnIndex = (...names: string[]) =>
    headers.findIndex((header) => names.some((name) => normalize(header) === normalize(name)));

  const setorIdx = getColumnIndex("Setor");
  const coletorIdx = getColumnIndex("Coletor");
  const snIdx = getColumnIndex("SN");
  const statusIdx = getColumnIndex("Status");
  const setorLocalizadoIdx = getColumnIndex("Setor localizado");

  const maintenanceRows = useMemo(() => {
    const query = normalize(search);

    return rows.filter((row) => {
      const status = statusIdx !== -1 ? String(row[statusIdx] || "").trim().toUpperCase() : "";
      const setor = setorIdx !== -1 ? String(row[setorIdx] || "").trim() : "";
      const local = setorLocalizadoIdx !== -1 ? String(row[setorLocalizadoIdx] || "").trim() : "";

      if (status !== "M" || normalize(setor) !== normalize("TI-SUPORTE")) return false;
      if (local && normalize(local) !== normalize("MANUTENÇÃO")) return false;
      if (!query) return true;

      const values = [
        coletorIdx !== -1 ? row[coletorIdx] : "",
        snIdx !== -1 ? row[snIdx] : "",
        setorIdx !== -1 ? row[setorIdx] : "",
        setorLocalizadoIdx !== -1 ? row[setorLocalizadoIdx] : "",
      ];

      return values.some((value) => normalize(String(value || "")).includes(query));
    });
  }, [rows, search, setorIdx, coletorIdx, snIdx, statusIdx, setorLocalizadoIdx]);

  const totalMaintenance = useMemo(
    () => rows.filter((row) => {
      const status = statusIdx !== -1 ? String(row[statusIdx] || "").trim().toUpperCase() : "";
      const setor = setorIdx !== -1 ? String(row[setorIdx] || "").trim() : "";
      const local = setorLocalizadoIdx !== -1 ? String(row[setorLocalizadoIdx] || "").trim() : "";
      return status === "M" && normalize(setor) === normalize("TI-SUPORTE") && (!local || normalize(local) === normalize("MANUTENÇÃO"));
    }).length,
    [rows, statusIdx, setorIdx, setorLocalizadoIdx]
  );

  const handleReturnToSupport = async (row: string[]) => {
    if (!canEdit || returningCollector) return;

    const collector = coletorIdx !== -1 ? String(row[coletorIdx] || "").trim() : "";
    const serial = snIdx !== -1 ? String(row[snIdx] || "").trim() : "";

    if (!collector) {
      await showAlert("Não foi possível identificar o Coletor do equipamento.", { variant: "error" });
      return;
    }

    const confirmed = await showConfirm(
      `Confirmar retorno do equipamento ${collector}${serial ? ` (SN ${serial})` : ""} para TI-SUPORTE?\n\nUse esta ação somente após a conclusão do reparo. O equipamento ficará disponível novamente para empréstimo.`,
      { title: "Retornar equipamento para TI-SUPORTE", confirmLabel: "Retornar para TI-SUPORTE", cancelLabel: "Cancelar" }
    );

    if (!confirmed) return;

    const rowIndexValue = (row as any)._originalIndex;
    const rowIndex = typeof rowIndexValue === "number" ? rowIndexValue + 1 : null;

    if (rowIndex === null) {
      await showAlert("Não foi possível identificar a linha do equipamento no controle.", { variant: "error" });
      return;
    }

    const updatedRow = [...row];
    if (statusIdx !== -1) updatedRow[statusIdx] = "A";
    if (setorLocalizadoIdx !== -1) updatedRow[setorLocalizadoIdx] = "TI-SUPORTE";

    setReturningCollector(collector);

    try {
      const response = await apiFetch("/api/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: "tbControleMobiles",
          rowIndex,
          rowData: updatedRow,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Não foi possível retornar o equipamento para TI-SUPORTE.");

      await showAlert(`Equipamento ${collector} retornado para TI-SUPORTE com sucesso.`, { variant: "success" });
      await onRefresh();
    } catch (error: any) {
      await showAlert(error.message || "Erro ao retornar o equipamento para TI-SUPORTE.", { variant: "error" });
    } finally {
      setReturningCollector("");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "40px",
    padding: "10px 12px",
    backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
    borderRadius: "8px",
    outline: "none",
    fontSize: "13px",
  };

  return (
    <div className="mobile-maintenance-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="mobile-section-intro">
        <div>
          <strong>Equipamentos em manutenção</strong>
          <span>Use esta área para acompanhar equipamentos reserva enviados para reparo e devolvê-los ao TI-SUPORTE somente após o conserto.</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "12px", alignItems: "center" }}>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar Coletor ou SN..."
          style={inputStyle}
          aria-label="Pesquisar equipamentos em manutenção"
        />
        <div style={{ minWidth: "150px", padding: "10px 14px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "8px", textAlign: "center" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Em manutenção</div>
          <strong style={{ color: "#F59E0B", fontSize: "20px" }}>{totalMaintenance}</strong>
        </div>
      </div>

      {!canEdit && (
        <div style={{ padding: "11px 13px", borderRadius: "9px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-muted)", fontSize: "12px" }}>
          Modo somente leitura. Apenas usuários com permissão de edição podem retornar equipamentos para TI-SUPORTE.
        </div>
      )}

      <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px", overflow: "hidden" }}>
        {maintenanceRows.length === 0 ? (
          <div style={{ padding: "30px 20px", color: "var(--text-muted)", textAlign: "center", fontSize: "13px" }}>
            {search ? "Nenhum equipamento em manutenção encontrado para a pesquisa." : "Nenhum equipamento reserva está aguardando retorno do reparo."}
          </div>
        ) : (
          <>
            <div className="mobile-maintenance-cards">
              {maintenanceRows.map((row, index) => {
                const collector = coletorIdx !== -1 ? String(row[coletorIdx] || "-").trim() : "-";
                const serial = snIdx !== -1 ? String(row[snIdx] || "-").trim() : "-";
                const sector = setorIdx !== -1 ? String(row[setorIdx] || "-").trim() : "-";
                const isReturning = returningCollector !== "" && normalize(returningCollector) === normalize(collector);

                return (
                  <article key={`${collector}-${serial}-${index}`} className="mobile-maintenance-card">
                    <div className="mobile-maintenance-card-top">
                      <div>
                        <strong>{collector}</strong>
                        <span>SN: {serial}</span>
                      </div>
                      <span className="mobile-maintenance-badge">MANUTENÇÃO</span>
                    </div>
                    <div className="mobile-maintenance-card-grid">
                      <div><span>Setor de referência</span><strong>{sector}</strong></div>
                      <div><span>Localização atual</span><strong>MANUTENÇÃO</strong></div>
                    </div>
                    <div className="mobile-maintenance-card-actions">
                      <button type="button" onClick={() => handleReturnToSupport(row)} disabled={!canEdit || Boolean(returningCollector)}>
                        {isReturning ? "Retornando..." : "↩ Retornar para TI-SUPORTE"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mobile-maintenance-desktop" style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-primary)" }}>
                    {[
                      "Coletor",
                      "SN",
                      "Setor de referência",
                      "Localização atual",
                      "Status",
                      "Ação",
                    ].map((title) => (
                      <th key={title} style={{ padding: "12px 14px", textAlign: "left", color: "var(--text-muted)", fontSize: "12px", fontWeight: 700, borderBottom: "1px solid var(--border-primary)", whiteSpace: "nowrap" }}>
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {maintenanceRows.map((row, index) => {
                    const collector = coletorIdx !== -1 ? String(row[coletorIdx] || "-").trim() : "-";
                    const serial = snIdx !== -1 ? String(row[snIdx] || "-").trim() : "-";
                    const sector = setorIdx !== -1 ? String(row[setorIdx] || "-").trim() : "-";
                    const isReturning = returningCollector !== "" && normalize(returningCollector) === normalize(collector);

                    return (
                      <tr key={`${collector}-${serial}-${index}`} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                        <td style={{ padding: "12px 14px", color: "var(--text-primary)", fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap" }}>{collector}</td>
                        <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontSize: "12px", whiteSpace: "nowrap" }}>{serial}</td>
                        <td style={{ padding: "12px 14px", color: "var(--text-primary)", fontSize: "13px" }}>{sector}</td>
                        <td style={{ padding: "12px 14px", color: "#F59E0B", fontSize: "13px", fontWeight: 700 }}>MANUTENÇÃO</td>
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}><span style={{ display: "inline-flex", padding: "5px 9px", borderRadius: "999px", backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.35)", fontSize: "11px", fontWeight: 700 }}>Manutenção</span></td>
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          <button type="button" onClick={() => handleReturnToSupport(row)} disabled={!canEdit || Boolean(returningCollector)} style={{ padding: "7px 10px", backgroundColor: "var(--bg-primary)", color: "#3B82F6", border: "1px solid var(--border-primary)", borderRadius: "7px", cursor: canEdit && !returningCollector ? "pointer" : "not-allowed", fontSize: "11px", fontWeight: 700, opacity: canEdit && !returningCollector ? 1 : 0.6 }}>
                            {isReturning ? "Retornando..." : "↩ Retornar para TI-SUPORTE"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
