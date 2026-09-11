import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../auth/api";
import DevolverMobileModal from "./DevolverMobileModal";
import MobileLoanHistory from "./MobileLoanHistory";
import MobileLoanTermModal from "./MobileLoanTermModal";
import MobileMaintenancePanel from "./MobileMaintenancePanel";
import { loanRowToTermData, type MobileLoanTermData } from "./mobileLoanTermData";

interface ReservasMobilesPanelProps {
  mode?: "operations" | "history";
  data: string[][];
  currentUserName: string;
  canEdit: boolean;
  onRefresh: () => void | Promise<void>;
}

type PanelView = "all" | "available" | "loaned" | "openLoans" | "history" | "maintenance" | "divergent";
type ReserveSortKey = "collector" | "serial" | "status" | "currentLocation" | "expectedLocation" | "locationStatus";

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export default function ReservasMobilesPanel({
  mode = "operations",
  data,
  currentUserName,
  canEdit,
  onRefresh,
}: ReservasMobilesPanelProps) {
  const [loans, setLoans] = useState<string[][]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnCollector, setReturnCollector] = useState("");
  const [termPreview, setTermPreview] = useState<{ type: "loan" | "return" | "responsibility"; data: MobileLoanTermData } | null>(null);
  const [activePanel, setActivePanel] = useState<PanelView>(mode === "history" ? "history" : "openLoans");
  const [reserveSort, setReserveSort] = useState<{ key: ReserveSortKey; direction: "asc" | "desc" }>({ key: "collector", direction: "asc" });

  const headers = data[0] || [];
  const rows = data.slice(1);

  const getIndex = (headerList: string[], name: string) =>
    headerList.findIndex((header) => normalize(header) === normalize(name));

  const setorIdx = getIndex(headers, "Setor");
  const coletorIdx = getIndex(headers, "Coletor");
  const snIdx = getIndex(headers, "SN");
  const statusIdx = getIndex(headers, "Status");
  const localizadoIdx = getIndex(headers, "Setor localizado");

  const reservas = useMemo(
    () =>
      rows.filter(
        (row) =>
          setorIdx !== -1 &&
          normalize(row[setorIdx] || "") === normalize("TI-SUPORTE")
      ),
    [rows, setorIdx]
  );

  const reservasDisponiveis = reservas.filter(
    (row) =>
      statusIdx !== -1 &&
      String(row[statusIdx] || "").trim().toUpperCase() === "A"
  );

  const reservasEmprestadas = reservas.filter(
    (row) =>
      statusIdx !== -1 &&
      String(row[statusIdx] || "").trim().toUpperCase() === "E"
  );

  const reservasManutencao = reservas.filter((row) => {
    const status = statusIdx !== -1 ? String(row[statusIdx] || "").trim().toUpperCase() : "";
    const local = localizadoIdx !== -1 ? String(row[localizadoIdx] || "").trim() : "";
    return status === "M" && (!local || normalize(local) === normalize("MANUTENÇÃO"));
  });

  const fetchLoans = useCallback(async () => {
    setLoadingLoans(true);
    setError(null);

    try {
      const response = await apiFetch("/api/data?sheet=tbEmprestimosMobiles");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Erro ao carregar empréstimos.");
      }

      setLoans(Array.isArray(result) ? result.filter((row) => Array.isArray(row)) : []);
    } catch (err: any) {
      console.error("Erro ao carregar tbEmprestimosMobiles:", err);
      setError(err.message || "Erro ao carregar empréstimos.");
      setLoans([]);
    } finally {
      setLoadingLoans(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans, data]);

  useEffect(() => {
    setActivePanel((current) => {
      if (mode === "history") return "history";
      return current === "history" ? "openLoans" : current;
    });
  }, [mode]);

  const loanHeaders = loans[0] || [];
  const loanRows = loans.slice(1);
  const loanIndex = (name: string) => getIndex(loanHeaders, name);

  const idIdx = loanIndex("ID_EMPRESTIMO");
  const reserveCollectorIdx = loanIndex("COLETOR_RESERVA");
  const reserveSnIdx = loanIndex("SN_RESERVA");
  const originalCollectorIdx = loanIndex("COLETOR_SUBSTITUIDO");
  const originalSnIdx = loanIndex("SN_SUBSTITUIDO");
  const destinationIdx = loanIndex("SETOR_DESTINO");
  const dateIdx = loanIndex("DATA_EMPRESTIMO");
  const responsibleIdx = loanIndex("RESPONSAVEL_EMPRESTIMO");
  const reasonIdx = loanIndex("MOTIVO");
  const loanStatusIdx = loanIndex("STATUS_EMPRESTIMO");

  const openLoans = loanRows.filter(
    (row) =>
      loanStatusIdx !== -1 &&
      String(row[loanStatusIdx] || "").trim().toUpperCase() === "ABERTO"
  );

  const getReserveCollector = (row: string[]) =>
    coletorIdx !== -1 ? String(row[coletorIdx] || "").trim() : "";

  const getReserveLocationRaw = (row: string[]) =>
    localizadoIdx !== -1 ? String(row[localizadoIdx] || "").trim() : "";

  const getOpenLoanForReserve = (collector: string) =>
    openLoans.find(
      (loan) =>
        reserveCollectorIdx !== -1 &&
        normalize(loan[reserveCollectorIdx] || "") === normalize(collector)
    );

  const getExpectedLocation = (row: string[]) => {
    const status = statusIdx !== -1 ? String(row[statusIdx] || "").trim().toUpperCase() : "";

    if (status === "A") return "TI-SUPORTE";

    if (status === "E") {
      const collector = getReserveCollector(row);
      const loan = collector ? getOpenLoanForReserve(collector) : undefined;
      if (!loan || destinationIdx === -1) return "";
      return String(loan[destinationIdx] || "").trim();
    }

    return "";
  };

  const isReserveLocationDivergent = (row: string[]) => {
    const currentLocation = getReserveLocationRaw(row);
    const expectedLocation = getExpectedLocation(row);

    if (!currentLocation || !expectedLocation) return false;
    return normalize(currentLocation) !== normalize(expectedLocation);
  };

  const reservasLocalizacaoDivergente = reservas.filter(isReserveLocationDivergent);

  const reservasDisponiveisForaTi = reservasDisponiveis.filter(
    (row) => isReserveLocationDivergent(row)
  );

  const getReserveRow = (collector: string) =>
    reservas.find(
      (item) => normalize(getReserveCollector(item)) === normalize(collector)
    );

  const getReserveLocation = (collector: string) => {
    const row = getReserveRow(collector);
    if (!row) return "-";
    return getReserveLocationRaw(row) || "-";
  };

  const isLoanLocationDivergent = (loan: string[]) => {
    const collector =
      reserveCollectorIdx !== -1 ? String(loan[reserveCollectorIdx] || "").trim() : "";
    const reserveRow = collector ? getReserveRow(collector) : undefined;
    return reserveRow ? isReserveLocationDivergent(reserveRow) : false;
  };

  const openLoansLocationDivergent = openLoans.filter(isLoanLocationDivergent);

  const visibleReserves = useMemo(() => {
    if (activePanel === "available") return reservasDisponiveis;
    if (activePanel === "loaned") return reservasEmprestadas;
    if (activePanel === "divergent") return reservasLocalizacaoDivergente;
    return reservas;
  }, [activePanel, reservas, reservasDisponiveis, reservasEmprestadas, reservasLocalizacaoDivergente]);

  const sortedVisibleReserves = useMemo(() => [...visibleReserves].sort((first, second) => {
    const value = (row: string[]) => {
      if (reserveSort.key === "collector") return getReserveCollector(row);
      if (reserveSort.key === "serial") return snIdx !== -1 ? String(row[snIdx] || "") : "";
      if (reserveSort.key === "status") return statusIdx !== -1 ? String(row[statusIdx] || "") : "";
      if (reserveSort.key === "currentLocation") return getReserveLocationRaw(row);
      if (reserveSort.key === "expectedLocation") return getExpectedLocation(row);
      return isReserveLocationDivergent(row) ? "Divergente" : "Sem divergência";
    };
    const comparison = value(first).localeCompare(value(second), "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
    return reserveSort.direction === "asc" ? comparison : -comparison;
  }), [reserveSort, visibleReserves]);

  const toggleReserveSort = (key: ReserveSortKey) => setReserveSort((previous) => ({
    key,
    direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc",
  }));

  const showingLoans = activePanel === "openLoans" || activePanel === "history";
  const displayedLoans = openLoans;

  const finishLoan = (loan: string[]) => {
    if (!canEdit) return;

    const reserveCollector =
      reserveCollectorIdx !== -1 ? String(loan[reserveCollectorIdx] || "").trim() : "";

    if (reserveCollector) setReturnCollector(reserveCollector);
  };

  const metricStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    flex: "0 0 auto",
    minWidth: "150px",
    padding: "10px 12px",
    border: "1px solid var(--border-primary)",
    borderRadius: "10px",
    backgroundColor: "var(--bg-primary)",
    textAlign: "left",
    cursor: "pointer",
  };

  const panelStyle = (panel: PanelView, accent: string): React.CSSProperties => ({
    ...metricStyle,
    border: activePanel === panel
      ? `1px solid ${accent}`
      : "1px solid var(--border-primary)",
    boxShadow: activePanel === panel
      ? `0 0 0 1px ${accent}22`
      : "none",
  });

  const getStatusLabel = (value: string) => {
    switch (String(value || "").trim().toUpperCase()) {
      case "A": return "Ativo";
      case "E": return "Emprestado";
      case "M": return "Manutenção";
      case "I": return "Inativo";
      default: return value || "Não informado";
    }
  };

  const getStatusStyle = (value: string): React.CSSProperties => {
    const status = String(value || "").trim().toUpperCase();
    if (status === "A") return { color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.35)", backgroundColor: "rgba(16, 185, 129, 0.10)" };
    if (status === "E") return { color: "#3B82F6", border: "1px solid rgba(59, 130, 246, 0.35)", backgroundColor: "rgba(59, 130, 246, 0.10)" };
    if (status === "M") return { color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.35)", backgroundColor: "rgba(245, 158, 11, 0.10)" };
    return { color: "var(--text-muted)", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)" };
  };

  return (
    <div className="mobile-reserves-panel" style={{ padding: "18px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px" }}>
      {mode === "operations" && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div>
          <strong style={{ color: "var(--text-primary)", fontSize: "15px" }}>Reservas TI-SUPORTE</strong>
          <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>
            Consulte reservas disponíveis, empréstimos em andamento e divergências de localização.
          </div>
        </div>
      </div>}

      {mode === "operations" && <div className="mobile-reserves-metrics" style={{ display: "flex", gap: "8px", marginBottom: "18px", overflowX: "auto", paddingBottom: "3px" }}>
        <button type="button" onClick={() => setActivePanel("all")} style={panelStyle("all", "#3B82F6")} title="Mostrar todas as reservas da TI-SUPORTE">
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Total de reservas</div>
          <strong style={{ color: "var(--text-primary)", fontSize: "24px" }}>{reservas.length}</strong>
        </button>
        <button type="button" onClick={() => setActivePanel("available")} style={panelStyle("available", "#10B981")} title="Mostrar somente reservas disponíveis">
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Disponíveis</div>
          <strong style={{ color: "#10B981", fontSize: "24px" }}>{reservasDisponiveis.length}</strong>
        </button>
        <button type="button" onClick={() => setActivePanel("loaned")} style={panelStyle("loaned", "#3B82F6")} title="Mostrar somente reservas emprestadas">
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Emprestadas</div>
          <strong style={{ color: "#3B82F6", fontSize: "24px" }}>{reservasEmprestadas.length}</strong>
        </button>
        <button type="button" onClick={() => setActivePanel("openLoans")} style={panelStyle("openLoans", "#F59E0B")} title="Mostrar empréstimos temporários em aberto">
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Empréstimos abertos</div>
          <strong style={{ color: "#F59E0B", fontSize: "24px" }}>{openLoans.length}</strong>
        </button>
        <button type="button" onClick={() => setActivePanel("maintenance")} style={panelStyle("maintenance", "#F59E0B")} title="Mostrar reservas aguardando manutenção ou reparo">
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Manutenção</div>
          <strong style={{ color: "#F59E0B", fontSize: "24px" }}>{reservasManutencao.length}</strong>
        </button>
        <button type="button" onClick={() => setActivePanel("divergent")} style={panelStyle("divergent", "#DC2626")} title="Mostrar reservas cuja localização atual difere da localização esperada">
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Localização divergente</div>
          <strong style={{ color: "#DC2626", fontSize: "24px" }}>{reservasLocalizacaoDivergente.length}</strong>
        </button>
      </div>}

      {mode === "operations" && reservasDisponiveisForaTi.length > 0 && (
        <div style={{ marginBottom: "14px", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(220, 38, 38, 0.35)", backgroundColor: "rgba(220, 38, 38, 0.08)", color: "#DC2626", fontSize: "12px" }}>
          ⚠ {reservasDisponiveisForaTi.length} reserva{reservasDisponiveisForaTi.length !== 1 ? "s" : ""} disponível{reservasDisponiveisForaTi.length !== 1 ? "is" : ""} fora da TI-SUPORTE: {reservasDisponiveisForaTi
            .map((row) => getReserveCollector(row))
            .filter(Boolean)
            .join(", ")}.
        </div>
      )}

      {error && <div style={{ color: "#DC2626", fontSize: "12px", marginBottom: "12px" }}>{error}</div>}

      {activePanel === "maintenance" ? (
        <MobileMaintenancePanel data={data} canEdit={canEdit} onRefresh={onRefresh} />
      ) : !showingLoans ? (
        <div>
          <div style={{ marginBottom: "10px", color: "var(--text-muted)", fontSize: "12px" }}>
            {activePanel === "available"
              ? "Reservas disponíveis"
              : activePanel === "loaned"
                ? "Reservas emprestadas"
                : activePanel === "divergent"
                  ? "Reservas com localização divergente"
                  : "Todas as reservas cadastradas na TI-SUPORTE"}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-primary)" }}>
                  {([
                    ["Reserva", "collector"],
                    ["SN", "serial"],
                    ["Status", "status"],
                    ["Localização atual", "currentLocation"],
                    ["Localização esperada", "expectedLocation"],
                    ["Situação da localização", "locationStatus"],
                  ] as Array<[string, ReserveSortKey]>).map(([title, key]) => {
                    const active = reserveSort.key === key;
                    return (
                      <th key={key} onClick={() => toggleReserveSort(key)} title="Clique para ordenar" style={{ padding: "10px 12px", textAlign: "left", color: active ? "var(--text-primary)" : "var(--text-muted)", fontSize: "11px", borderBottom: "1px solid var(--border-primary)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          {title}
                          <span style={{ fontSize: "10px", opacity: active ? 1 : 0.45 }}>{active ? (reserveSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleReserves.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "18px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                      Nenhuma reserva encontrada para este filtro.
                    </td>
                  </tr>
                ) : (
                  sortedVisibleReserves.map((row, index) => {
                    const collector = getReserveCollector(row) || "-";
                    const status = statusIdx !== -1 ? String(row[statusIdx] || "").trim() : "";
                    const location = getReserveLocationRaw(row);
                    const expectedLocation = getExpectedLocation(row);
                    const locationDivergent = isReserveLocationDivergent(row);
                    const divergenceLabel = status.toUpperCase() === "A" ? "⚠ Fora da TI-SUPORTE" : "⚠ Fora do destino";

                    return (
                      <tr key={`${collector}-${snIdx !== -1 ? row[snIdx] || index : index}`} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 700 }}>{collector}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{snIdx !== -1 ? row[snIdx] || "-" : "-"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, ...getStatusStyle(status) }}>
                            {getStatusLabel(status)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{location || "-"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{expectedLocation || "-"}</td>
                        <td style={{ padding: "10px 12px", fontSize: "11px" }}>
                          {locationDivergent ? (
                            <span title={`Localização esperada: ${expectedLocation}`} style={{ display: "inline-flex", padding: "4px 7px", borderRadius: "999px", backgroundColor: "rgba(220, 38, 38, 0.10)", color: "#DC2626", border: "1px solid rgba(220, 38, 38, 0.30)", fontWeight: 700 }}>
                              {divergenceLabel}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>Sem divergência</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activePanel === "history" ? (
        <MobileLoanHistory
          headers={loanHeaders}
          rows={loanRows}
          loading={loadingLoans}
          getCurrentLocation={getReserveLocation}
          onOpenTerm={(type, termData) => setTermPreview({ type, data: termData })}
        />
      ) : (
        <div>
          <div style={{ marginBottom: "10px", color: "var(--text-muted)", fontSize: "12px" }}>Empréstimos temporários em aberto</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1020px" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-primary)" }}>
                  {["Reserva", "SN Reserva", "Substituindo", "SN Substituído", "Setor destino", "Localização atual", "Data", "Responsável", "Motivo", "Ação"].map((title) => (
                    <th key={title} style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-muted)", fontSize: "11px", borderBottom: "1px solid var(--border-primary)", whiteSpace: "nowrap" }}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedLoans.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "18px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                      {loadingLoans ? "Carregando empréstimos..." : "Nenhum empréstimo aberto."}
                    </td>
                  </tr>
                ) : (
                  displayedLoans.map((loan, index) => {
                    const reserveCollector = reserveCollectorIdx !== -1 ? loan[reserveCollectorIdx] || "-" : "-";
                    const key = idIdx !== -1 ? loan[idIdx] || `${reserveCollector}-${index}` : `${reserveCollector}-${index}`;
                    const currentLocation = getReserveLocation(String(reserveCollector));
                    const destination = destinationIdx !== -1 ? String(loan[destinationIdx] || "").trim() : "";
                    const locationDivergent = isLoanLocationDivergent(loan);
                    const termData = loanRowToTermData(loanHeaders, loan);
                    const finalized = normalize(termData.status) === "finalizado";

                    return (
                      <tr key={key} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                        <td style={{ padding: "10px 12px", color: "#3B82F6", fontWeight: 700 }}>{reserveCollector}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{reserveSnIdx !== -1 ? loan[reserveSnIdx] || "-" : "-"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 600 }}>{originalCollectorIdx !== -1 ? loan[originalCollectorIdx] || "-" : "-"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{originalSnIdx !== -1 ? loan[originalSnIdx] || "-" : "-"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{destination || "-"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span>{currentLocation}</span>
                            {locationDivergent && (
                              <span title={`Destino esperado: ${destination}`} style={{ display: "inline-flex", alignItems: "center", padding: "4px 7px", borderRadius: "999px", backgroundColor: "rgba(220, 38, 38, 0.10)", color: "#DC2626", border: "1px solid rgba(220, 38, 38, 0.30)", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap" }}>
                                ⚠ Fora do destino
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{dateIdx !== -1 ? loan[dateIdx] || "-" : "-"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{responsibleIdx !== -1 ? loan[responsibleIdx] || "-" : "-"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{reasonIdx !== -1 ? loan[reasonIdx] || "-" : "-"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button type="button" onClick={() => setTermPreview({ type: "loan", data: termData })} style={{ padding: "7px 9px", color: "#3B82F6", background: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>Termo empréstimo</button>
                            {finalized && termData.returnDate && <button type="button" onClick={() => setTermPreview({ type: "return", data: termData })} style={{ padding: "7px 9px", color: "#8B5CF6", background: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>Termo devolução</button>}
                            {!finalized && canEdit && <button type="button" onClick={() => finishLoan(loan)} style={{ padding: "7px 10px", backgroundColor: "#10B981", color: "#FFFFFF", border: "none", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>Finalizar empréstimo</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openLoansLocationDivergent.length > 0 && activePanel === "openLoans" && (
        <div style={{ marginTop: "10px", color: "var(--text-muted)", fontSize: "11px" }}>
          {openLoansLocationDivergent.length} empréstimo{openLoansLocationDivergent.length !== 1 ? "s" : ""} aberto{openLoansLocationDivergent.length !== 1 ? "s" : ""} com localização divergente.
        </div>
      )}
      <DevolverMobileModal
        isOpen={Boolean(returnCollector)}
        reserveCollector={returnCollector}
        currentUserName={currentUserName}
        onClose={() => setReturnCollector("")}
        onSuccess={async () => {
          await Promise.resolve(onRefresh());
          await fetchLoans();
        }}
      />
      <MobileLoanTermModal
        isOpen={termPreview !== null}
        type={termPreview?.type || "loan"}
        data={termPreview?.data || null}
        onClose={() => setTermPreview(null)}
      />
    </div>
  );
}
