import React, { useCallback, useEffect, useMemo, useState } from "react";

interface ReservasMobilesPanelProps {
  data: string[][];
  currentUserName: string;
  canEdit: boolean;
  onRefresh: () => void | Promise<void>;
}

type PanelView = "all" | "available" | "loaned" | "openLoans" | "divergent";

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export default function ReservasMobilesPanel({
  data,
  currentUserName,
  canEdit,
  onRefresh,
}: ReservasMobilesPanelProps) {
  const [loans, setLoans] = useState<string[][]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishingCollector, setFinishingCollector] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<PanelView>("openLoans");

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

  const reservasDisponiveisForaTi = reservasDisponiveis.filter((row) => {
    if (localizadoIdx === -1) return false;
    const location = String(row[localizadoIdx] || "").trim();
    if (!location) return false;
    return normalize(location) !== normalize("TI-SUPORTE");
  });

  const fetchLoans = useCallback(async () => {
    setLoadingLoans(true);
    setError(null);

    try {
      const response = await fetch("/api/data?sheet=tbEmprestimosMobiles");
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

  const getReserveRow = (collector: string) =>
    reservas.find(
      (item) =>
        coletorIdx !== -1 &&
        normalize(item[coletorIdx] || "") === normalize(collector)
    );

  const getReserveLocationRaw = (collector: string) => {
    const row = getReserveRow(collector);
    if (!row || localizadoIdx === -1) return "";
    return String(row[localizadoIdx] || "").trim();
  };

  const getReserveLocation = (collector: string) => {
    const rawLocation = getReserveLocationRaw(collector);
    return rawLocation || "TI-SUPORTE";
  };

  const isLoanLocationDivergent = (loan: string[]) => {
    const reserveCollector =
      reserveCollectorIdx !== -1 ? String(loan[reserveCollectorIdx] || "").trim() : "";
    const destination =
      destinationIdx !== -1 ? String(loan[destinationIdx] || "").trim() : "";
    const currentLocation = getReserveLocationRaw(reserveCollector);

    if (!reserveCollector || !destination || !currentLocation) return false;
    return normalize(destination) !== normalize(currentLocation);
  };

  const openLoansLocationDivergent = openLoans.filter(isLoanLocationDivergent);

  const visibleReserves = useMemo(() => {
    if (activePanel === "available") return reservasDisponiveis;
    if (activePanel === "loaned") return reservasEmprestadas;
    return reservas;
  }, [activePanel, reservas, reservasDisponiveis, reservasEmprestadas]);

  const visibleOpenLoans = activePanel === "divergent"
    ? openLoansLocationDivergent
    : openLoans;

  const showingLoans = activePanel === "openLoans" || activePanel === "divergent";

  const finishLoan = async (loan: string[]) => {
    if (!canEdit) return;

    const reserveCollector =
      reserveCollectorIdx !== -1 ? String(loan[reserveCollectorIdx] || "").trim() : "";

    if (!reserveCollector) {
      alert("Não foi possível identificar o coletor reserva.");
      return;
    }

    if (!window.confirm(`Finalizar o empréstimo da reserva ${reserveCollector}?`)) {
      return;
    }

    const updateLocation = window.confirm(
      "Deseja atualizar também o setor de localização na devolução?"
    );

    let returnSector = "";
    if (updateLocation) {
      const suggestedSector =
        destinationIdx !== -1 ? String(loan[destinationIdx] || "").trim() : "";

      const informedSector = window.prompt(
        "Informe o setor onde o equipamento original ficará localizado:",
        suggestedSector
      );

      if (informedSector === null) return;
      returnSector = informedSector.trim();

      if (!returnSector) {
        alert("Informe o setor de localização para concluir a devolução.");
        return;
      }
    }

    const observation =
      window.prompt("Observação da devolução (opcional):", "") ?? "";

    setFinishingCollector(reserveCollector);

    try {
      const response = await fetch("/api/mobiles/loan-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserveCollector,
          responsible: currentUserName,
          observation: observation.trim(),
          updateLocation,
          returnSector,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Erro ao finalizar empréstimo.");
      }

      await Promise.resolve(onRefresh());
      await fetchLoans();
      alert("Empréstimo finalizado com sucesso.");
    } catch (err: any) {
      console.error("Erro ao finalizar empréstimo:", err);
      alert(err.message || "Erro ao finalizar empréstimo.");
    } finally {
      setFinishingCollector(null);
    }
  };

  const metricStyle: React.CSSProperties = {
    padding: "14px 16px",
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
    <div
      style={{
        padding: "18px",
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border-primary)",
        borderRadius: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div>
          <strong style={{ color: "var(--text-primary)", fontSize: "15px" }}>
            Reservas TI-SUPORTE
          </strong>
          <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>
            Clique nos painéis para alternar entre reservas disponíveis, emprestadas e empréstimos em andamento.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
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
        <button type="button" onClick={() => setActivePanel("divergent")} style={panelStyle("divergent", "#DC2626")} title="Mostrar empréstimos cuja localização atual difere do setor de destino">
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Fora do destino</div>
          <strong style={{ color: "#DC2626", fontSize: "24px" }}>{openLoansLocationDivergent.length}</strong>
        </button>
      </div>

      {reservasDisponiveisForaTi.length > 0 && (
        <div
          style={{
            marginBottom: "14px",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(220, 38, 38, 0.35)",
            backgroundColor: "rgba(220, 38, 38, 0.08)",
            color: "#DC2626",
            fontSize: "12px",
          }}
        >
          ⚠ {reservasDisponiveisForaTi.length} reserva{reservasDisponiveisForaTi.length !== 1 ? "s" : ""} disponível{reservasDisponiveisForaTi.length !== 1 ? "is" : ""} fora da TI-SUPORTE: {reservasDisponiveisForaTi
            .map((row) => (coletorIdx !== -1 ? String(row[coletorIdx] || "").trim() : ""))
            .filter(Boolean)
            .join(", ")}.
        </div>
      )}

      {error && (
        <div style={{ color: "#DC2626", fontSize: "12px", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      {!showingLoans ? (
        <div>
          <div style={{ marginBottom: "10px", color: "var(--text-muted)", fontSize: "12px" }}>
            {activePanel === "available"
              ? "Reservas disponíveis"
              : activePanel === "loaned"
                ? "Reservas emprestadas"
                : "Todas as reservas cadastradas na TI-SUPORTE"}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "650px" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-primary)" }}>
                  {["Reserva", "SN", "Status", "Localização atual", "Situação da localização"].map((title) => (
                    <th key={title} style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-muted)", fontSize: "11px", borderBottom: "1px solid var(--border-primary)", whiteSpace: "nowrap" }}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleReserves.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "18px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                      Nenhuma reserva encontrada para este filtro.
                    </td>
                  </tr>
                ) : (
                  visibleReserves.map((row, index) => {
                    const collector = coletorIdx !== -1 ? String(row[coletorIdx] || "").trim() : "-";
                    const status = statusIdx !== -1 ? String(row[statusIdx] || "").trim() : "";
                    const location = localizadoIdx !== -1 ? String(row[localizadoIdx] || "").trim() : "";
                    const availableOutsideTi = status.toUpperCase() === "A" && location && normalize(location) !== normalize("TI-SUPORTE");
                    return (
                      <tr key={`${collector}-${snIdx !== -1 ? row[snIdx] || index : index}`} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 700 }}>{collector || "-"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{snIdx !== -1 ? row[snIdx] || "-" : "-"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, ...getStatusStyle(status) }}>
                            {getStatusLabel(status)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>{location || "TI-SUPORTE"}</td>
                        <td style={{ padding: "10px 12px", fontSize: "11px" }}>
                          {availableOutsideTi ? (
                            <span style={{ display: "inline-flex", padding: "4px 7px", borderRadius: "999px", backgroundColor: "rgba(220, 38, 38, 0.10)", color: "#DC2626", border: "1px solid rgba(220, 38, 38, 0.30)", fontWeight: 700 }}>
                              ⚠ Fora da TI-SUPORTE
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
      ) : (
        <div>
          <div style={{ marginBottom: "10px", color: "var(--text-muted)", fontSize: "12px" }}>
            {activePanel === "divergent" ? "Empréstimos abertos fora do setor de destino" : "Empréstimos temporários em aberto"}
          </div>
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
                {visibleOpenLoans.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "18px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                      {loadingLoans
                        ? "Carregando empréstimos..."
                        : activePanel === "divergent"
                          ? "Nenhum empréstimo aberto com divergência de localização."
                          : "Nenhum empréstimo aberto."}
                    </td>
                  </tr>
                ) : (
                  visibleOpenLoans.map((loan, index) => {
                    const reserveCollector = reserveCollectorIdx !== -1 ? loan[reserveCollectorIdx] || "-" : "-";
                    const key = idIdx !== -1 ? loan[idIdx] || `${reserveCollector}-${index}` : `${reserveCollector}-${index}`;
                    const currentLocation = getReserveLocation(String(reserveCollector));
                    const destination = destinationIdx !== -1 ? String(loan[destinationIdx] || "").trim() : "";
                    const locationDivergent = isLoanLocationDivergent(loan);

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
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => finishLoan(loan)}
                              disabled={finishingCollector === reserveCollector}
                              style={{ padding: "7px 10px", backgroundColor: "#10B981", color: "#FFFFFF", border: "none", borderRadius: "7px", cursor: finishingCollector === reserveCollector ? "not-allowed" : "pointer", fontSize: "11px", fontWeight: 700 }}
                            >
                              {finishingCollector === reserveCollector ? "Finalizando..." : "Finalizar empréstimo"}
                            </button>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Somente leitura</span>
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
      )}
    </div>
  );
}
