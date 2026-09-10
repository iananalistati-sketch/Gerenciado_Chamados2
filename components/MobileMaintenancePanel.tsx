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
  const [returningRow, setReturningRow] = useState<number | null>(null);

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

      return [
        coletorIdx !== -1 ? row[coletorIdx] : "",
        snIdx !== -1 ? row[snIdx] : "",
        setorIdx !== -1 ? row[setorIdx] : "",
      ].some((value) => normalize(String(value || "")).includes(query));
    });
  }, [rows, search, statusIdx, setorIdx, setorLocalizadoIdx, coletorIdx, snIdx]);

  const totalMaintenance = useMemo(
    () => rows.filter((row) => {
      const status = statusIdx !== -1 ? String(row[statusIdx] || "").trim().toUpperCase() : "";
      const setor = setorIdx !== -1 ? String(row[setorIdx] || "").trim() : "";
      const local = setorLocalizadoIdx !== -1 ? String(row[setorLocalizadoIdx] || "").trim() : "";
      return status === "M" && normalize(setor) === normalize("TI-SUPORTE") && (!local || normalize(local) === normalize("MANUTENÇÃO"));
    }).length,
    [rows, statusIdx, setorIdx, setorLocalizadoIdx]
  );

  const getOriginalIndex = (row: string[]) => {
    const value = (row as any)._originalIndex;
    return typeof value === "number" ? value : null;
  };

  const handleReturnToSupport = async (row: string[]) => {
    if (!canEdit || returningRow !== null) return;

    const rowIndex = getOriginalIndex(row);
    const collector = coletorIdx !== -1 ? String(row[coletorIdx] || "").trim() : "";
    const serial = snIdx !== -1 ? String(row[snIdx] || "").trim() : "";

    if (rowIndex === null) {
      await showAlert("Não foi possível identificar a linha original do equipamento.", { variant: "error" });
      return;
    }
    if (!collector) {
      await showAlert("Não foi possível identificar o Coletor do equipamento.", { variant: "error" });
      return;
    }

    const confirmed = await showConfirm(
      `Confirmar retorno do equipamento ${collector}${serial ? ` (SN ${serial})` : ""} para TI-SUPORTE?\n\nUse esta ação somente após a conclusão do reparo. O equipamento ficará disponível novamente para empréstimo.`,
      {
        title: "Retornar equipamento para TI-SUPORTE",
        confirmLabel: "Retornar para TI-SUPORTE",
        cancelLabel: "Cancelar",
      }
    );

    if (!confirmed) return;

    const updatedRow = [...row];
    if (statusIdx !== -1) updatedRow[statusIdx] = "A";
    if (setorLocalizadoIdx !== -1) updatedRow[setorLocalizadoIdx] = "TI-SUPORTE";

    setReturningRow(rowIndex);
    try {
      const response = await apiFetch("/api/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowData: updatedRow,
          rowIndex,
          sheet: "tbControleMobiles",
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Não foi possível retornar o equipamento para TI-SUPORTE.");

      await onRefresh();
      await showAlert(`Equipamento ${collector} retornado para TI-SUPORTE com sucesso.`, { variant: "success" });
    } catch (error: any) {
      await showAlert(error?.message || "Erro ao retornar o equipamento para TI-SUPORTE.", { variant: "error" });
    } finally {
      setReturningRow(null);
    }
  };

  const panelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
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
    <div className="mobile-maintenance-panel" style={panelStyle}>
      <div className="mobile-section-intro">
        <div>
          <strong>Equipamentos em manutenção</strong>
          <span>Reservas enviadas para reparo. Após a conclusão do conserto, retorne o equipamento para TI-SUPORTE por esta área.</span>
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
        <div style={{ minWidth: "140px", padding: "9px 14px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "8px", textAlign: "center" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {maintenanceRows.map((row, index) => {
              const rowIndex = getOriginalIndex(row);
              const collector = coletorIdx !== -1 ? String(row[coletorIdx] || "-").trim() : "-";
              const serial = snIdx !== -1 ? String(row[snIdx] || "-").trim() : "-";
              const sector = setorIdx !== -1 ? String(row[setorIdx] || "-").trim() : "-";
              const isReturning = rowIndex !== null && returningRow === rowIndex;

              return (
                <article key={`${collector}-${serial}-${index}`} style={{ padding: "15px", borderBottom: "1px solid var(--border-primary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: "3px" }}><strong style={{ color: "var(--text-primary)" }}>{collector}</strong><span style={{ color: "var(--text-muted)", fontSize: "11px" }}>SN: {serial}</span></div>
                    <span style={{ color: "#F59E0B", fontSize: "10px", fontWeight: 700 }}>MANUTENÇÃO</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "12px" }}>
                    <div><span style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>Setor de referência</span><strong style={{ fontSize: "12px" }}>{sector}</strong></div>
                    <div><span style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>Localização atual</span><strong style={{ color: "#F59E0B", fontSize: "12px" }}>MANUTENÇÃO</strong></div>
                  </div>
                  <button type="button" onClick={() => handleReturnToSupport(row)} disabled={!canEdit || returningRow !== null} style={{ width: "100%", marginTop: "12px", minHeight: "40px", padding: "8px 10px", color: "#3B82F6", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", cursor: canEdit && returningRow === null ? "pointer" : "not-allowed", fontSize: "11px", fontWeight: 700, opacity: canEdit && returningRow === null ? 1 : 0.6 }}>{isReturning ? "Retornando..." : "↩ Retornar para TI-SUPORTE"}</button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
