import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../auth/api";
import type { Permissions } from "../../auth/permissions";
import { exportRowsToXlsx } from "../../utils/exportXlsx";
import ReservasMobilesPanel from "../ReservasMobilesPanel";
import TabletFormModal from "./TabletFormModal";
import TabletAppsPanel from "./TabletAppsPanel";
import {
  TABLET_SHEETS,
  appUpdateStatus,
  buttonStyle,
  cell,
  getToday,
  headerIndex,
  inputStyle,
  normalize,
  sortText,
  statusColor,
  statusLabel,
  withOriginalIndex,
} from "./tabletData";

interface ControleTabletsProps {
  data: string[][];
  loading: boolean;
  error: string | null;
  currentUserName: string;
  permissions: Permissions;
  onRefresh: () => void | Promise<void>;
}

type Section = "inventory" | "apps" | "loans" | "history";
const PAGE_SIZE = 20;

export default function ControleTablets({ data, loading, error, currentUserName, permissions, onRefresh }: ControleTabletsProps) {
  const [section, setSection] = useState<Section>("inventory");
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ row: string[] | null } | null>(null);
  const [apps, setApps] = useState<string[][]>([]);
  const [config, setConfig] = useState<string[][]>([]);
  const [appsError, setAppsError] = useState<string | null>(null);

  const headers = data[0] || [];
  const rows = data.slice(1);
  const idx = {
    tablet: headerIndex(headers, "Coletor", "Tablet"),
    sn: headerIndex(headers, "SN"),
    setor: headerIndex(headers, "Setor"),
    setorLocalizado: headerIndex(headers, "Setor localizado"),
    mac: headerIndex(headers, "MAC"),
    patrimonio: headerIndex(headers, "PATRIMONIO_REPROMAQ", "Patrimônio Repromaq", "Patrimonio Repromaq"),
    status: headerIndex(headers, "Status"),
  };

  const loadApps = useCallback(async () => {
    setAppsError(null);
    try {
      const [appsResponse, configResponse] = await Promise.all([
        apiFetch(`/api/data?sheet=${TABLET_SHEETS.apps}`),
        apiFetch(`/api/data?sheet=${TABLET_SHEETS.config}`),
      ]);
      const [appsResult, configResult] = await Promise.all([appsResponse.json(), configResponse.json()]);
      if (!appsResponse.ok) throw new Error(appsResult?.error || `Erro ao carregar ${TABLET_SHEETS.apps}.`);
      if (!configResponse.ok) throw new Error(configResult?.error || `Erro ao carregar ${TABLET_SHEETS.config}.`);
      setApps(withOriginalIndex(appsResult));
      setConfig(withOriginalIndex(configResult));
    } catch (err: any) {
      setApps([]);
      setConfig([]);
      setAppsError(err?.message || "Erro ao carregar apps dos tablets.");
    }
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps, data]);

  useEffect(() => setPage(1), [search, sectorFilter, statusFilter]);

  const refreshAll = async () => {
    await Promise.resolve(onRefresh());
    await loadApps();
  };

  // Resumo de apps por tablet para a coluna "Apps" do inventário.
  const appsByTablet = useMemo(() => {
    const appHeaders = apps[0] || [];
    const configHeaders = config[0] || [];
    const aTablet = headerIndex(appHeaders, "COLETOR");
    const aApp = headerIndex(appHeaders, "APP_USO");
    const aVersion = headerIndex(appHeaders, "VERSAO");
    const cApp = headerIndex(configHeaders, "APP_USO");
    const cTarget = headerIndex(configHeaders, "VERSAO_ALVO");
    const targets: Record<string, string> = {};
    config.slice(1).forEach((row) => {
      if (cell(row, cApp)) targets[normalize(cell(row, cApp))] = cell(row, cTarget);
    });
    const result: Record<string, { total: number; pending: number }> = {};
    apps.slice(1).forEach((row) => {
      const key = normalize(cell(row, aTablet));
      if (!key) return;
      const status = appUpdateStatus(cell(row, aVersion), targets[normalize(cell(row, aApp))] || "");
      result[key] = result[key] || { total: 0, pending: 0 };
      result[key].total += 1;
      if (status === "PENDENTE") result[key].pending += 1;
    });
    return result;
  }, [apps, config]);

  const counts = useMemo(() => {
    const byStatus = (status: string) => rows.filter((row) => cell(row, idx.status).toUpperCase() === status).length;
    return { total: rows.length, A: byStatus("A"), E: byStatus("E"), M: byStatus("M"), I: byStatus("I") };
  }, [rows, idx.status]);

  const sectors = useMemo(() => Array.from(new Set(rows.map((row) => cell(row, idx.setor)).filter(Boolean))).sort(sortText), [rows, idx.setor]);

  const isOutOfSector = (row: string[]) =>
    cell(row, idx.status).toUpperCase() === "A" &&
    Boolean(cell(row, idx.setorLocalizado)) &&
    normalize(cell(row, idx.setorLocalizado)) !== normalize(cell(row, idx.setor));

  const filtered = useMemo(() => {
    const query = normalize(search);
    return rows
      .filter((row) => !sectorFilter || normalize(cell(row, idx.setor)) === normalize(sectorFilter))
      .filter((row) => !statusFilter || cell(row, idx.status).toUpperCase() === statusFilter)
      .filter((row) => !query || [idx.tablet, idx.sn, idx.mac, idx.patrimonio, idx.setor, idx.setorLocalizado].some((index) => normalize(cell(row, index)).includes(query)))
      .sort((a, b) => sortText(cell(a, idx.setor), cell(b, idx.setor)) || sortText(cell(a, idx.tablet), cell(b, idx.tablet)));
  }, [rows, search, sectorFilter, statusFilter, idx.setor, idx.status, idx.tablet, idx.sn, idx.mac, idx.patrimonio, idx.setorLocalizado]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportInventory = () =>
    exportRowsToXlsx(
      `tablets-inventario-${getToday()}.xlsx`,
      "Inventário de tablets",
      [
        { header: "Setor", width: 22, value: (row: string[]) => cell(row, idx.setor) },
        { header: "Setor localizado", width: 22, value: (row) => cell(row, idx.setorLocalizado) },
        { header: "Tablet", width: 20, value: (row) => cell(row, idx.tablet) },
        { header: "SN", width: 18, value: (row) => cell(row, idx.sn) },
        { header: "MAC", width: 20, value: (row) => cell(row, idx.mac) },
        { header: "Patrimônio Repromaq", width: 20, value: (row) => cell(row, idx.patrimonio) },
        { header: "Apps", width: 10, value: (row) => String(appsByTablet[normalize(cell(row, idx.tablet))]?.total || 0) },
        { header: "Apps pendentes", width: 14, value: (row) => String(appsByTablet[normalize(cell(row, idx.tablet))]?.pending || 0) },
        { header: "Status", width: 14, value: (row) => statusLabel(cell(row, idx.status)) },
      ],
      filtered
    );

  const navigation: Array<{ key: Section; label: string; description: string }> = [
    { key: "inventory", label: "Inventário", description: "Cadastro e situação" },
    { key: "apps", label: "Apps e versões", description: "Instalados e versões-alvo" },
    ...(permissions.canViewTabletLoans
      ? [
          { key: "loans" as Section, label: "Empréstimos", description: "Reservas e devoluções" },
          { key: "history" as Section, label: "Histórico", description: "Empréstimos e termos" },
        ]
      : []),
  ];

  const statusCards = [
    { key: "", label: "Total", value: counts.total, color: "var(--text-primary)" },
    { key: "A", label: "Ativos", value: counts.A, color: "#10B981" },
    { key: "E", label: "Emprestados", value: counts.E, color: "#3B82F6" },
    { key: "M", label: "Manutenção", value: counts.M, color: "#F59E0B" },
    { key: "I", label: "Inativos", value: counts.I, color: "var(--text-muted)" },
  ];

  const thStyle: React.CSSProperties = { padding: "10px 12px", textAlign: "left", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, borderBottom: "1px solid var(--border-primary)", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--border-primary)", fontSize: "12px", color: "var(--text-primary)", verticalAlign: "top" };

  return (
    <div className="mobile-control" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="mobile-control-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "24px" }}>Controle de Tablets</h2>
          <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>Inventário, apps instalados e empréstimos de tablets.</p>
        </div>
        <div className="mobile-control-actions" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" onClick={refreshAll} disabled={loading} style={{ ...buttonStyle("secondary"), cursor: loading ? "not-allowed" : "pointer" }}>↻ Atualizar</button>
          {permissions.canCreateTablet && <button type="button" onClick={() => setEditing({ row: null })} disabled={loading || headers.length === 0} style={buttonStyle("primary")}>+ Novo tablet</button>}
        </div>
      </div>

      <nav className="mobile-control-navigation" aria-label="Áreas do Controle de Tablets">
        {navigation.map((item) => (
          <button key={item.key} type="button" className={section === item.key ? "is-active" : ""} aria-current={section === item.key ? "page" : undefined} onClick={() => setSection(item.key)}>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </nav>

      {error && (
        <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#EF4444", fontSize: "13px" }}>{error}</div>
      )}

      {section === "inventory" && (
        <>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {statusCards.map((card) => {
              const active = statusFilter === card.key && (card.key !== "" || !statusFilter);
              return (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === card.key ? "" : card.key)}
                  style={{ minWidth: "130px", padding: "12px 16px", textAlign: "left", backgroundColor: "var(--bg-secondary)", border: active ? "1px solid #3B82F6" : "1px solid var(--border-primary)", borderRadius: "10px", cursor: "pointer" }}
                >
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600 }}>{card.label}</div>
                  <div style={{ color: card.color, fontSize: "24px", fontWeight: 700 }}>{card.value}</div>
                </button>
              );
            })}
          </div>

          <div className="mobile-filter-panel" style={{ padding: "18px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px" }}>
            <div className="mobile-filter-primary">
              <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar tablet, SN, MAC, patrimônio ou setor..." style={inputStyle} />
              <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} style={inputStyle}>
                <option value="">Todos os setores</option>
                {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
                <option value="">Todos os status</option>
                {["A", "E", "M", "I"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
              <button type="button" onClick={exportInventory} disabled={filtered.length === 0} style={buttonStyle("secondary")}>Exportar</button>
            </div>
          </div>

          <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px", overflowX: "auto" }}>
            {loading ? (
              <div style={{ padding: "30px 20px", color: "var(--text-muted)", textAlign: "center", fontSize: "13px" }}>Carregando tablets...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "30px 20px", color: "var(--text-muted)", textAlign: "center", fontSize: "13px" }}>
                {rows.length === 0 ? "Nenhum tablet cadastrado ainda." : "Nenhum tablet encontrado para os filtros aplicados."}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Tablet", "Setor", "Setor localizado", "MAC", "Patrimônio", "Apps", "Status", ""].map((title) => <th key={title} style={thStyle}>{title}</th>)}</tr>
                </thead>
                <tbody>
                  {pageRows.map((row, index) => {
                    const summary = appsByTablet[normalize(cell(row, idx.tablet))];
                    const status = cell(row, idx.status).toUpperCase();
                    return (
                      <tr key={`${cell(row, idx.tablet)}-${cell(row, idx.sn)}-${index}`}>
                        <td style={tdStyle}><strong>{cell(row, idx.tablet) || "-"}</strong><div style={{ color: "var(--text-muted)", fontSize: "10px" }}>SN {cell(row, idx.sn) || "-"}</div></td>
                        <td style={tdStyle}>{cell(row, idx.setor) || "-"}</td>
                        <td style={tdStyle}>{cell(row, idx.setorLocalizado) || "-"}{isOutOfSector(row) && <div style={{ color: "#F59E0B", fontSize: "10px", fontWeight: 700 }}>⚠ Fora do setor</div>}</td>
                        <td style={tdStyle}>{cell(row, idx.mac) || "-"}</td>
                        <td style={tdStyle}>{cell(row, idx.patrimonio) || "-"}</td>
                        <td style={tdStyle}>{summary ? <>{summary.total}{summary.pending > 0 && <span style={{ color: "#F59E0B", fontWeight: 700 }}> · {summary.pending} pendente(s)</span>}</> : "-"}</td>
                        <td style={{ ...tdStyle, color: statusColor(status), fontWeight: 700 }}>{statusLabel(status)}</td>
                        <td style={tdStyle}>
                          <button type="button" onClick={() => setEditing({ row })} style={{ ...buttonStyle("accent"), padding: "6px 10px", fontSize: "11px" }}>
                            {permissions.canEditTablet ? "Editar" : "Detalhes"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", color: "var(--text-muted)", fontSize: "12px" }}>
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} style={buttonStyle("secondary")}>Anterior</button>
              Página {page} de {totalPages}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} style={buttonStyle("secondary")}>Próxima</button>
            </div>
          )}
        </>
      )}

      {section === "apps" && (
        appsError ? (
          <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#EF4444", fontSize: "13px" }}>
            {appsError} Verifique se as abas {TABLET_SHEETS.apps} e {TABLET_SHEETS.config} existem na planilha.
          </div>
        ) : (
          <TabletAppsPanel tablets={data} apps={apps} config={config} permissions={permissions} currentUserName={currentUserName} onReload={loadApps} />
        )
      )}

      {section === "loans" && permissions.canViewTabletLoans && (
        <ReservasMobilesPanel device="tablet" mode="operations" data={data} currentUserName={currentUserName} canEdit={permissions.canReturnTabletLoan} onRefresh={refreshAll} />
      )}
      {section === "history" && permissions.canViewTabletLoans && (
        <ReservasMobilesPanel device="tablet" mode="history" data={data} currentUserName={currentUserName} canEdit={permissions.canReturnTabletLoan} onRefresh={refreshAll} />
      )}

      <TabletFormModal
        isOpen={editing !== null}
        row={editing?.row || null}
        headers={headers}
        allRows={rows}
        permissions={permissions}
        currentUserName={currentUserName}
        onClose={() => setEditing(null)}
        onSaved={refreshAll}
      />
    </div>
  );
}
