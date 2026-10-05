import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../auth/api";
import ExternalMaintenanceTermModal from "./ExternalMaintenanceTermModal";
import RetornoManutencaoExternaModal from "./RetornoManutencaoExternaModal";
import {
  EXTERNAL_MAINTENANCE_SHEET,
  maintenanceRowToTermData,
  type ExternalMaintenanceTermData,
} from "./externalMaintenanceData";

interface ManutencaoExternaPanelProps {
  data: string[][];
  currentUserName: string;
  canManage: boolean;
  onRefresh: () => void | Promise<void>;
}

type Filter = "open" | "finished" | "all";

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const formatDate = (value: string) => {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export default function ManutencaoExternaPanel({
  data,
  currentUserName,
  canManage,
  onRefresh,
}: ManutencaoExternaPanelProps) {
  const [records, setRecords] = useState<ExternalMaintenanceTermData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [termPreview, setTermPreview] = useState<{ type: "receipt" | "return"; data: ExternalMaintenanceTermData } | null>(null);
  const [returningRecord, setReturningRecord] = useState<ExternalMaintenanceTermData | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/data?sheet=${EXTERNAL_MAINTENANCE_SHEET}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Erro ao carregar manutenções externas.");
      const values: string[][] = Array.isArray(result) ? result.filter((row) => Array.isArray(row)) : [];
      const headers = values[0] || [];
      setRecords(values.slice(1).map((row) => maintenanceRowToTermData(headers, row)).filter((item) => item.maintenanceId));
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar manutenções externas.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords, data]);

  const openCount = records.filter((item) => normalize(item.status) === "aberta").length;
  const finishedCount = records.length - openCount;

  const visibleRecords = useMemo(() => {
    const query = normalize(search);
    return records
      .filter((item) => {
        const isOpen = normalize(item.status) === "aberta";
        if (filter === "open" && !isOpen) return false;
        if (filter === "finished" && isOpen) return false;
        if (!query) return true;
        return [item.collector, item.serial, item.originSector, item.deliveryName, item.serviceOrder, item.maintenanceId]
          .some((value) => normalize(value).includes(query));
      })
      .sort((a, b) => b.sendDate.localeCompare(a.sendDate));
  }, [records, filter, search]);

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
  const filterStyle = (key: Filter, color: string): React.CSSProperties => ({
    minWidth: "140px",
    padding: "9px 14px",
    backgroundColor: "var(--bg-secondary)",
    border: filter === key ? `1px solid ${color}` : "1px solid var(--border-primary)",
    borderRadius: "8px",
    textAlign: "center",
    cursor: "pointer",
  });
  const actionStyle = (color: string, enabled = true): React.CSSProperties => ({
    flex: "1 1 auto",
    minHeight: "36px",
    padding: "7px 10px",
    color,
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-primary)",
    borderRadius: "8px",
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: "11px",
    fontWeight: 700,
    opacity: enabled ? 1 : 0.6,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="mobile-section-intro">
        <div>
          <strong>Manutenção externa</strong>
          <span>Equipamentos enviados para assistência técnica externa sem empréstimo de reserva. Registre o retorno e reimprima os termos por aqui.</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => setFilter("open")} style={filterStyle("open", "#8B5CF6")}>
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Em aberto</div>
          <strong style={{ color: "#8B5CF6", fontSize: "20px" }}>{openCount}</strong>
        </button>
        <button type="button" onClick={() => setFilter("finished")} style={filterStyle("finished", "#10B981")}>
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Finalizadas</div>
          <strong style={{ color: "#10B981", fontSize: "20px" }}>{finishedCount}</strong>
        </button>
        <button type="button" onClick={() => setFilter("all")} style={filterStyle("all", "#3B82F6")}>
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Todas</div>
          <strong style={{ color: "var(--text-primary)", fontSize: "20px" }}>{records.length}</strong>
        </button>
      </div>

      <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar Coletor, SN, setor, colaborador ou OS..." style={inputStyle} aria-label="Pesquisar manutenções externas" />

      {!canManage && (
        <div style={{ padding: "11px 13px", borderRadius: "9px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-muted)", fontSize: "12px" }}>
          Modo somente leitura. Apenas usuários com permissão de gerenciar manutenção podem registrar o retorno.
        </div>
      )}

      {error && (
        <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#EF4444", fontSize: "12px" }}>{error}</div>
      )}

      <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "30px 20px", color: "var(--text-muted)", textAlign: "center", fontSize: "13px" }}>Carregando manutenções externas...</div>
        ) : visibleRecords.length === 0 ? (
          <div style={{ padding: "30px 20px", color: "var(--text-muted)", textAlign: "center", fontSize: "13px" }}>
            {search ? "Nenhuma manutenção externa encontrada para a pesquisa." : filter === "open" ? "Nenhum equipamento aguardando retorno da manutenção externa." : "Nenhuma manutenção externa registrada."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
            {visibleRecords.map((item) => {
              const isOpen = normalize(item.status) === "aberta";
              return (
                <article key={item.maintenanceId} style={{ padding: "15px", borderBottom: "1px solid var(--border-primary)", borderRight: "1px solid var(--border-primary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: "3px" }}>
                      <strong style={{ color: "var(--text-primary)" }}>{item.collector || "-"}</strong>
                      <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>SN: {item.serial || "-"} · {item.maintenanceId}</span>
                    </div>
                    <span style={{ color: isOpen ? "#8B5CF6" : "#10B981", fontSize: "10px", fontWeight: 700 }}>{isOpen ? "EM ABERTO" : "FINALIZADA"}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "12px", fontSize: "12px" }}>
                    <div><span style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>Setor</span><strong>{item.originSector || "-"}</strong></div>
                    <div><span style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>Envio</span><strong>{formatDate(item.sendDate)}</strong></div>
                    <div><span style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>Entregue por</span><strong>{item.deliveryName || "-"}</strong></div>
                    <div><span style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>{isOpen ? "OS" : "Retorno"}</span><strong>{isOpen ? item.serviceOrder || "-" : formatDate(item.returnDate)}</strong></div>
                    <div style={{ gridColumn: "1 / -1" }}><span style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>Defeito relatado</span><span style={{ color: "var(--text-secondary)" }}>{item.reportedDefect || "-"}</span></div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                    <button type="button" onClick={() => setTermPreview({ type: "receipt", data: item })} style={actionStyle("#8B5CF6")}>Termo de recebimento</button>
                    {!isOpen && <button type="button" onClick={() => setTermPreview({ type: "return", data: item })} style={actionStyle("#10B981")}>Termo de devolução</button>}
                    {isOpen && canManage && <button type="button" onClick={() => setReturningRecord(item)} style={actionStyle("#3B82F6")}>↩ Registrar retorno</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <ExternalMaintenanceTermModal
        isOpen={termPreview !== null}
        type={termPreview?.type || "receipt"}
        data={termPreview?.data || null}
        onClose={() => setTermPreview(null)}
      />
      <RetornoManutencaoExternaModal
        isOpen={returningRecord !== null}
        record={returningRecord}
        currentUserName={currentUserName}
        onClose={() => setReturningRecord(null)}
        onSuccess={async () => {
          setReturningRecord(null);
          await Promise.resolve(onRefresh());
          await fetchRecords();
        }}
      />
    </div>
  );
}
