import React, { useEffect, useMemo, useState } from "react";
import EditarMobileModal from "./EditarMobileModal";
import NovoMobileModal from "./NovoMobileModal";
import AtualizacaoLoteMobilesModal from "./AtualizacaoLoteMobilesModal";
import DetalhesAppsMobileModal from "./DetalhesAppsMobileModal";
import ReservasMobilesPanel from "./ReservasMobilesPanel";

interface ControleMobilesProps {
  data: string[][];
  mobileConfig: string[][];
  mobileApps: string[][];
  loading: boolean;
  error: string | null;
  currentUserName: string;
  canEdit: boolean;
  onRefresh: () => void;

  onSaveRow: (
    rowData: string[],
    rowIndex: number
  ) => Promise<void>;

  onSaveMobileApp: (
    rowData: string[],
    rowIndex: number
  ) => Promise<void>;

  onCreateRow: (
    rowData: string[]
  ) => Promise<void>;

  onBulkUpdate: (
    updates: Array<{
      rowIndex: number;
      rowData: string[];
    }>
  ) => Promise<void>;
}

const normalize = (value: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeValue = (value: string) =>
  normalize(String(value || ""));

type MobileSection = "overview" | "equipment" | "loans" | "history";

export default function ControleMobiles({
  data,
  mobileConfig,
  mobileApps,
  loading,
  error,
  currentUserName,
  canEdit,
  onRefresh,
  onSaveRow,
  onSaveMobileApp,
  onCreateRow,
  onBulkUpdate,
}: ControleMobilesProps) {
  const [search, setSearch] = useState("");
  const [setorFilter, setSetorFilter] = useState("");
  const [setorLocalizadoFilter, setSetorLocalizadoFilter] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusAtualizacaoFilter, setStatusAtualizacaoFilter] = useState("");
  const [versaoFilter, setVersaoFilter] = useState("");
  const [locationDivergenceOnly, setLocationDivergenceOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingRow, setEditingRow] = useState<string[] | null>(null);
  const [viewingAppsRow, setViewingAppsRow] = useState<string[] | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "", direction: "asc" });
  const [activeSection, setActiveSection] = useState<MobileSection>("equipment");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const itemsPerPage = 20;
  const headers = data[0] || [];
  const rows = data.slice(1);

  const getColumnIndex = (...possibleNames: string[]) =>
    headers.findIndex((header) =>
      possibleNames.some((name) => normalize(header) === normalize(name))
    );

  const setorIdx = getColumnIndex("Setor");
  const coletorIdx = getColumnIndex("Coletor");
  const snIdx = getColumnIndex("SN");
  const finalIdx = getColumnIndex("FINAL");
  const macIdx = getColumnIndex("MAC");
  const appIdx = getColumnIndex("App de uso", "Aplicativo", "App");
  const setorLocalizadoIdx = getColumnIndex("Setor localizado");
  const statusIdx = getColumnIndex("Status");
  const statusAtualizacaoIdx = getColumnIndex("Status atualização", "Status atualizacao");

  const targetVersions = useMemo(() => {
    const map: Record<string, string> = {};
    if (!mobileConfig || mobileConfig.length <= 1) return map;
    const configHeaders = mobileConfig[0] || [];
    const appIndex = configHeaders.findIndex((header) => normalize(header) === normalize("APP_USO"));
    const versionIndex = configHeaders.findIndex((header) => normalize(header) === normalize("VERSAO_ALVO"));
    if (appIndex === -1 || versionIndex === -1) return map;
    mobileConfig.slice(1).forEach((row) => {
      const app = String(row[appIndex] || "").trim();
      const version = String(row[versionIndex] || "").trim();
      if (app && version) map[normalize(app)] = version;
    });
    return map;
  }, [mobileConfig]);

  const getAutomaticUpdateStatus = (app: string, currentVersion: string) => {
    const targetVersion = targetVersions[normalize(app)];
    const version = String(currentVersion || "").trim();
    if (!version || !targetVersion) return "SEM INFORMAÇÃO";
    return version === targetVersion ? "ATUALIZADO" : "PENDENTE";
  };

  const mobileAppHeaders = mobileApps[0] || [];
  const mobileAppColetorIdx = mobileAppHeaders.findIndex((header) => normalize(header) === normalize("COLETOR"));
  const mobileAppAppIdx = mobileAppHeaders.findIndex((header) => normalize(header) === normalize("APP_USO"));
  const mobileAppVersaoIdx = mobileAppHeaders.findIndex((header) => normalize(header) === normalize("VERSAO"));

  const mobileAppsByColetor = useMemo(() => {
    const map: Record<string, string[][]> = {};
    if (!mobileApps || mobileApps.length <= 1 || mobileAppColetorIdx === -1) return map;
    mobileApps.slice(1).forEach((row) => {
      const coletor = String(row[mobileAppColetorIdx] || "").trim();
      if (!coletor) return;
      const key = normalize(coletor);
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return map;
  }, [mobileApps, mobileAppColetorIdx]);

  const getMobileAppStatus = (appRow: string[]) => {
    if (mobileAppAppIdx === -1 || mobileAppVersaoIdx === -1) return "SEM INFORMAÇÃO";
    return getAutomaticUpdateStatus(
      String(appRow[mobileAppAppIdx] || "").trim(),
      String(appRow[mobileAppVersaoIdx] || "").trim()
    );
  };

  const getAppRowsForEquipment = (row: string[]) => {
    if (coletorIdx === -1) return [];
    const coletor = String(row[coletorIdx] || "").trim();
    return coletor ? mobileAppsByColetor[normalize(coletor)] || [] : [];
  };

  const getMobileUpdateSummary = (row: string[]) => {
    const appRows = getAppRowsForEquipment(row);
    if (appRows.length === 0) return { totalApps: 0, updatedApps: 0, pendingApps: 0, unknownApps: 0, status: "SEM INFORMAÇÃO" };
    let updatedApps = 0;
    let pendingApps = 0;
    let unknownApps = 0;
    appRows.forEach((appRow) => {
      const status = normalizeValue(getMobileAppStatus(appRow));
      if (status === "atualizado") updatedApps++;
      else if (status === "pendente") pendingApps++;
      else unknownApps++;
    });
    let status = "ATUALIZADO";
    if (pendingApps > 0) status = "PENDENTE";
    else if (unknownApps > 0) status = "SEM INFORMAÇÃO";
    return { totalApps: appRows.length, updatedApps, pendingApps, unknownApps, status };
  };

  const isLocationDivergent = (row: string[]) => {
    if (setorIdx === -1 || setorLocalizadoIdx === -1 || statusIdx === -1) return false;

    const status = String(row[statusIdx] || "").trim().toUpperCase();
    const setor = String(row[setorIdx] || "").trim();
    const localizado = String(row[setorLocalizadoIdx] || "").trim();

    if (status !== "A" || !setor || !localizado) return false;

    return normalizeValue(setor) !== normalizeValue(localizado);
  };

  const getOriginalIndex = (row: string[]): number | null => {
    const value = (row as any)._originalIndex;
    return typeof value === "number" ? value : null;
  };

  const viewingAppsColetor = viewingAppsRow && coletorIdx !== -1 ? String(viewingAppsRow[coletorIdx] || "").trim() : "";
  const viewingApps = viewingAppsColetor ? mobileAppsByColetor[normalize(viewingAppsColetor)] || [] : [];

  const uniqueValues = (columnIndex: number) => {
    if (columnIndex === -1) return [];
    return Array.from(new Set(rows.map((row) => String(row[columnIndex] || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true })
    );
  };

  const setores = useMemo(() => uniqueValues(setorIdx), [data, setorIdx]);
  const setoresLocalizados = useMemo(() => uniqueValues(setorLocalizadoIdx), [data, setorLocalizadoIdx]);
  const apps = useMemo(() => {
    if (mobileAppAppIdx === -1) return [];
    return Array.from(new Set(mobileApps.slice(1).map((row) => String(row[mobileAppAppIdx] || "").trim()).filter((value) => value && normalize(value) !== "todos"))).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true })
    );
  }, [mobileApps, mobileAppAppIdx]);
  const statusOptions = useMemo(() => uniqueValues(statusIdx), [data, statusIdx]);
  const statusAtualizacaoOptions = useMemo(() => ["ATUALIZADO", "PENDENTE", "SEM INFORMAÇÃO"], []);

  const versoes = useMemo(() => {
    if (mobileAppVersaoIdx === -1) return [];
    return Array.from(new Set(mobileApps.slice(1).filter((row) => !appFilter || mobileAppAppIdx === -1 || normalizeValue(row[mobileAppAppIdx] || "") === normalizeValue(appFilter)).map((row) => String(row[mobileAppVersaoIdx] || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true })
    );
  }, [mobileApps, mobileAppAppIdx, mobileAppVersaoIdx, appFilter]);

  useEffect(() => {
    if (versaoFilter && !versoes.some((versao) => normalizeValue(versao) === normalizeValue(versaoFilter))) setVersaoFilter("");
  }, [appFilter, versoes, versaoFilter]);

  const totalEquipamentos = rows.length;
  const totalAtivos = statusIdx !== -1 ? rows.filter((row) => String(row[statusIdx] || "").trim().toUpperCase() === "A").length : 0;
  const totalInativos = statusIdx !== -1 ? rows.filter((row) => String(row[statusIdx] || "").trim().toUpperCase() === "I").length : 0;
  const totalManutencao = statusIdx !== -1 ? rows.filter((row) => String(row[statusIdx] || "").trim().toUpperCase() === "M").length : 0;
  const totalEmprestados = statusIdx !== -1 ? rows.filter((row) => String(row[statusIdx] || "").trim().toUpperCase() === "E").length : 0;
  const totalAtualizados = rows.filter((row) => normalizeValue(getMobileUpdateSummary(row).status) === "atualizado").length;
  const totalPendentes = rows.filter((row) => normalizeValue(getMobileUpdateSummary(row).status) === "pendente").length;
  const totalNaoLocalizados = statusAtualizacaoIdx !== -1 ? rows.filter((row) => normalizeValue(row[statusAtualizacaoIdx] || "") === "nao localizado").length : 0;
  const totalLocationDivergences = rows.filter(isLocationDivergent).length;
  const percentualAtualizacao = totalEquipamentos > 0 ? (totalAtualizados / totalEquipamentos) * 100 : 0;
  const progressoAtualizacao = percentualAtualizacao > 0 && percentualAtualizacao < 1
    ? percentualAtualizacao.toFixed(1).replace(".", ",")
    : String(Math.round(percentualAtualizacao));

  const filteredRows = useMemo(() => rows.filter((row) => {
    const appRows = getAppRowsForEquipment(row);
    const appRowsMatchingApp = appFilter && mobileAppAppIdx !== -1 ? appRows.filter((appRow) => normalizeValue(appRow[mobileAppAppIdx] || "") === normalizeValue(appFilter)) : appRows;
    const searchValue = normalizeValue(search);
    if (searchValue) {
      const physicalSearchValues = [setorIdx, coletorIdx, snIdx, finalIdx, macIdx, setorLocalizadoIdx].filter((index) => index !== -1).map((index) => normalizeValue(row[index] || ""));
      const appSearchValues = appRows.flatMap((appRow) => [mobileAppAppIdx !== -1 ? normalizeValue(appRow[mobileAppAppIdx] || "") : "", mobileAppVersaoIdx !== -1 ? normalizeValue(appRow[mobileAppVersaoIdx] || "") : ""]);
      if (![...physicalSearchValues, ...appSearchValues].some((value) => value.includes(searchValue))) return false;
    }
    if (setorFilter && normalizeValue(row[setorIdx] || "") !== normalizeValue(setorFilter)) return false;
    if (setorLocalizadoFilter && normalizeValue(row[setorLocalizadoIdx] || "") !== normalizeValue(setorLocalizadoFilter)) return false;
    if (appFilter && appRowsMatchingApp.length === 0) return false;
    if (statusFilter && normalizeValue(row[statusIdx] || "") !== normalizeValue(statusFilter)) return false;
    if (statusAtualizacaoFilter) {
      if (appFilter) {
        if (!appRowsMatchingApp.some((appRow) => normalizeValue(getMobileAppStatus(appRow)) === normalizeValue(statusAtualizacaoFilter))) return false;
      } else if (normalizeValue(getMobileUpdateSummary(row).status) !== normalizeValue(statusAtualizacaoFilter)) return false;
    }
    if (versaoFilter) {
      const versionRows = appFilter ? appRowsMatchingApp : appRows;
      if (mobileAppVersaoIdx === -1 || !versionRows.some((appRow) => normalizeValue(appRow[mobileAppVersaoIdx] || "") === normalizeValue(versaoFilter))) return false;
    }
    if (locationDivergenceOnly && !isLocationDivergent(row)) return false;
    return true;
  }), [rows, search, setorFilter, setorLocalizadoFilter, appFilter, statusFilter, statusAtualizacaoFilter, versaoFilter, locationDivergenceOnly, setorIdx, coletorIdx, snIdx, finalIdx, macIdx, setorLocalizadoIdx, statusIdx, mobileAppsByColetor, mobileAppAppIdx, mobileAppVersaoIdx, targetVersions]);

  useEffect(() => setCurrentPage(1), [search, setorFilter, setorLocalizadoFilter, appFilter, statusFilter, statusAtualizacaoFilter, versaoFilter, locationDivergenceOnly]);

  const handleSort = (key: string) => {
    setSortConfig((previous) => ({
      key,
      direction:
        previous.key === key && previous.direction === "asc"
          ? "desc"
          : "asc",
    }));
    setCurrentPage(1);
  };

  const getSortValue = (row: string[], key: string): string | number => {
    switch (key) {
      case "setor":
        return setorIdx !== -1 ? String(row[setorIdx] || "") : "";
      case "setorLocalizado":
        return setorLocalizadoIdx !== -1 ? String(row[setorLocalizadoIdx] || "") : "";
      case "coletor":
        return coletorIdx !== -1 ? String(row[coletorIdx] || "") : "";
      case "sn":
        return snIdx !== -1 ? String(row[snIdx] || "") : "";
      case "mac":
        return macIdx !== -1 ? String(row[macIdx] || "") : "";
      case "app":
        return appIdx !== -1 ? String(row[appIdx] || "") : "";
      case "appsAtualizados": {
        const summary = getMobileUpdateSummary(row);
        return summary.totalApps > 0
          ? summary.updatedApps / summary.totalApps
          : -1;
      }
      case "statusAtualizacao":
        return getMobileUpdateSummary(row).status;
      case "status":
        return statusIdx !== -1 ? String(row[statusIdx] || "") : "";
      default:
        return "";
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const first = getSortValue(a, sortConfig.key);
      const second = getSortValue(b, sortConfig.key);

      let comparison = 0;

      if (typeof first === "number" && typeof second === "number") {
        comparison = first - second;
      } else {
        comparison = String(first).localeCompare(String(second), "pt-BR", {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredRows, sortConfig, setorIdx, setorLocalizadoIdx, coletorIdx, snIdx, macIdx, appIdx, statusIdx, mobileAppsByColetor, mobileAppAppIdx, mobileAppVersaoIdx, targetVersions]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / itemsPerPage));
  const paginatedRows = sortedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const clearFilters = () => {
    setSearch("");
    setSetorFilter("");
    setSetorLocalizadoFilter("");
    setAppFilter("");
    setStatusFilter("");
    setStatusAtualizacaoFilter("");
    setVersaoFilter("");
    setLocationDivergenceOnly(false);
    setCurrentPage(1);
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((current) => normalizeValue(current) === normalizeValue(status) ? "" : status);
    setCurrentPage(1);
  };

  const toggleUpdateStatusFilter = (status: string) => {
    setStatusAtualizacaoFilter((current) => normalizeValue(current) === normalizeValue(status) ? "" : status);
    setCurrentPage(1);
  };

  const toggleLocationDivergenceFilter = () => {
    setLocationDivergenceOnly((current) => !current);
    setCurrentPage(1);
  };

  const handleEdit = (row: string[]) => { if (canEdit) setEditingRow(row); };
  const handleCloseEdit = () => setEditingRow(null);
  const handleToggleRow = (row: string[]) => {
    const rowIndex = getOriginalIndex(row);
    if (rowIndex === null) return;
    setSelectedRows((previous) => previous.includes(rowIndex) ? previous.filter((item) => item !== rowIndex) : [...previous, rowIndex]);
  };
  const currentPageIndexes = paginatedRows.map(getOriginalIndex).filter((value): value is number => value !== null);
  const allCurrentPageSelected = currentPageIndexes.length > 0 && currentPageIndexes.every((rowIndex) => selectedRows.includes(rowIndex));
  const handleToggleCurrentPage = () => {
    if (allCurrentPageSelected) setSelectedRows((previous) => previous.filter((rowIndex) => !currentPageIndexes.includes(rowIndex)));
    else setSelectedRows((previous) => Array.from(new Set([...previous, ...currentPageIndexes])));
  };
  const clearSelection = () => setSelectedRows([]);

  const handleBulkUpdate = async (values: { versao: string; dataAtualizacao: string; status: string; statusAtualizacao: string; observacao: string; }) => {
    const versaoHeader = headers.find((header) => normalize(header) === normalize("Versão") || normalize(header) === normalize("Versao"));
    const dataAtualizacaoHeader = headers.find((header) => normalize(header) === normalize("Data atualização") || normalize(header) === normalize("Data atualizacao"));
    const statusHeader = headers.find((header) => normalize(header) === normalize("Status"));
    const statusAtualizacaoHeader = headers.find((header) => normalize(header) === normalize("Status atualização") || normalize(header) === normalize("Status atualizacao"));
    const obsHeader = headers.find((header) => normalize(header) === normalize("Obs"));
    const selectedData = rows.filter((row) => { const rowIndex = getOriginalIndex(row); return rowIndex !== null && selectedRows.includes(rowIndex); });
    const preparedUpdates: Array<{ rowIndex: number; rowData: string[] }> = [];
    for (const row of selectedData) {
      const rowIndex = getOriginalIndex(row); if (rowIndex === null) continue;
      const updatedRow = [...row];
      const setValue = (header: string | undefined, value: string) => { if (!header) return; const index = headers.indexOf(header); if (index !== -1) updatedRow[index] = value; };
      if (values.status) setValue(statusHeader, values.status);
      if (values.statusAtualizacao) setValue(statusAtualizacaoHeader, values.statusAtualizacao);
      if (values.observacao) setValue(obsHeader, values.observacao);
      if (values.dataAtualizacao) setValue(dataAtualizacaoHeader, values.dataAtualizacao);
      if (values.versao) setValue(versaoHeader, values.versao.trim());
      preparedUpdates.push({ rowIndex, rowData: updatedRow });
    }
    if (preparedUpdates.length === 0) return;
    await onBulkUpdate(preparedUpdates); clearSelection();
  };

  const hasActiveFilters = search || setorFilter || setorLocalizadoFilter || appFilter || statusFilter || statusAtualizacaoFilter || versaoFilter || locationDivergenceOnly;
  const advancedFilterCount = [setorLocalizadoFilter, appFilter, statusAtualizacaoFilter, versaoFilter].filter(Boolean).length;
  const getStatusLabel = (value: string) => {
    switch (String(value || "").trim().toUpperCase()) {
      case "A": return "Ativo";
      case "E": return "Emprestado";
      case "I": return "Inativo";
      case "M": return "Manutenção";
      default: return value || "Não informado";
    }
  };
  const getStatusStyle = (value: string): React.CSSProperties => {
    const status = String(value || "").trim().toUpperCase();
    if (status === "A") return { backgroundColor: "rgba(5, 150, 105, 0.14)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.35)" };
    if (status === "E") return { backgroundColor: "rgba(59, 130, 246, 0.14)", color: "#3B82F6", border: "1px solid rgba(59, 130, 246, 0.35)" };
    if (status === "M") return { backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.35)" };
    if (status === "I") return { backgroundColor: "rgba(100, 116, 139, 0.14)", color: "var(--text-muted)", border: "1px solid var(--border-primary)" };
    return { backgroundColor: "var(--bg-primary)", color: "var(--text-muted)", border: "1px solid var(--border-primary)" };
  };
  const getUpdateStatusStyle = (value: string): React.CSSProperties => {
    const status = normalizeValue(value);
    if (status === "atualizado") return { backgroundColor: "rgba(5, 150, 105, 0.14)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.35)" };
    if (status === "pendente") return { backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.35)" };
    return { backgroundColor: "var(--bg-primary)", color: "var(--text-muted)", border: "1px solid var(--border-primary)" };
  };
  const inputStyle: React.CSSProperties = { padding: "10px 12px", backgroundColor: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", fontSize: "13px", outline: "none", minHeight: "40px" };

  const cards = [
    { label: "Total de Equipamentos", value: totalEquipamentos, detail: `${totalAtivos} ativos`, filter: "TOTAL" },
    { label: "Atualizados", value: totalAtualizados, detail: `${progressoAtualizacao}% do total`, filter: "ATUALIZADO" },
    { label: "Pendentes", value: totalPendentes, detail: "Aguardando atualização", filter: "PENDENTE" },
    { label: "Não Localizados", value: totalNaoLocalizados, detail: "Conferência pendente", filter: "" },
    { label: "Fora do setor", value: totalLocationDivergences, detail: "Ativos em localização divergente", filter: "LOCATION" },
  ];

  const statusCards = [
    { label: "Ativos", value: totalAtivos, color: "var(--text-primary)", filter: "A" },
    { label: "Emprestados", value: totalEmprestados, color: "#3B82F6", filter: "E" },
    { label: "Manutenção", value: totalManutencao, color: "#F59E0B", filter: "M" },
    { label: "Inativos", value: totalInativos, color: "var(--text-primary)", filter: "I" },
  ];

  const tableColumns = [
    { title: "Setor", key: "setor" },
    { title: "Setor localizado", key: "setorLocalizado" },
    { title: "Coletor", key: "coletor" },
    { title: "SN", key: "sn" },
    { title: "MAC", key: "mac" },
    { title: "App de uso", key: "app" },
    { title: "Apps atualizados", key: "appsAtualizados" },
    { title: "Status atualização", key: "statusAtualizacao" },
    { title: "Status", key: "status" },
    { title: "Ações", key: "" },
  ];

  const navigationItems: Array<{ key: MobileSection; label: string; description: string }> = [
    { key: "overview", label: "Visão geral", description: "Indicadores e atalhos" },
    { key: "equipment", label: "Equipamentos", description: "Inventário e atualizações" },
    { key: "loans", label: "Empréstimos", description: "Reservas e devoluções" },
    { key: "history", label: "Histórico de manutenções", description: "Consultas e exportação" },
  ];

  return (
    <div className="mobile-control" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="mobile-control-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "24px" }}>Controle de Mobiles</h2>
          <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>Controle de equipamentos, versões e atualizações.</p>
        </div>
        <div className="mobile-control-actions" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" onClick={onRefresh} disabled={loading} style={{ padding: "10px 16px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600 }}>↻ Atualizar</button>
          {canEdit && <button type="button" onClick={() => setShowCreateModal(true)} style={{ padding: "10px 16px", backgroundColor: "#3B82F6", color: "#FFFFFF", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 700, boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.2)" }}>+ Novo Equipamento</button>}
        </div>
      </div>

      <nav className="mobile-control-navigation" aria-label="Áreas do Controle de Mobiles">
        {navigationItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeSection === item.key ? "is-active" : ""}
            aria-current={activeSection === item.key ? "page" : undefined}
            onClick={() => setActiveSection(item.key)}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </nav>

      {activeSection === "overview" && <div className="mobile-section-intro">
        <div><strong>Visão geral do parque</strong><span>Selecione um indicador para abrir o inventário já filtrado.</span></div>
      </div>}

      {activeSection === "overview" && <div className="mobile-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "16px" }}>
        {cards.map((card) => {
          const isLocationCard = card.filter === "LOCATION";
          const isActive = card.filter === "TOTAL"
            ? !hasActiveFilters
            : isLocationCard
              ? locationDivergenceOnly
              : card.filter && normalizeValue(statusAtualizacaoFilter) === normalizeValue(card.filter);
          const clickable = card.filter !== "";
          return (
            <div
              key={card.label}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => {
                if (card.filter === "TOTAL") clearFilters();
                else if (isLocationCard) toggleLocationDivergenceFilter();
                else if (card.filter) toggleUpdateStatusFilter(card.filter);
                if (clickable) setActiveSection("equipment");
              }}
              onKeyDown={(event) => {
                if (!clickable || (event.key !== "Enter" && event.key !== " ")) return;
                event.preventDefault();
                if (card.filter === "TOTAL") clearFilters();
                else if (isLocationCard) toggleLocationDivergenceFilter();
                else toggleUpdateStatusFilter(card.filter);
                setActiveSection("equipment");
              }}
              style={{
                padding: "20px",
                backgroundColor: "var(--bg-secondary)",
                border: isActive ? "1px solid #3B82F6" : "1px solid var(--border-primary)",
                borderRadius: "12px",
                cursor: clickable ? "pointer" : "default",
                boxShadow: isActive ? "0 0 0 1px rgba(59, 130, 246, 0.18)" : "none",
              }}
              title={clickable ? "Clique para aplicar/remover o filtro rápido" : ""}
            >
              <div style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>{card.label}</div>
              <div style={{ color: "var(--text-primary)", fontSize: "28px", fontWeight: 700 }}>{card.value}</div>
              <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "6px" }}>{card.detail}</div>
            </div>
          );
        })}
      </div>}

      {(activeSection === "overview" || activeSection === "equipment") && <div className="mobile-status-filters" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {statusCards.map((item) => {
          const isActive = normalizeValue(statusFilter) === normalizeValue(item.filter);
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                toggleStatusFilter(item.filter);
                setActiveSection("equipment");
              }}
              style={{
                padding: "8px 12px",
                backgroundColor: "var(--bg-secondary)",
                border: isActive ? "1px solid #3B82F6" : "1px solid var(--border-primary)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: isActive ? "0 0 0 1px rgba(59, 130, 246, 0.18)" : "none",
              }}
              title="Clique para aplicar/remover o filtro rápido"
            >
              {item.label}: <strong style={{ color: item.color }}>{item.value}</strong>
            </button>
          );
        })}
      </div>}

      {activeSection === "loans" && <ReservasMobilesPanel mode="operations" data={data} currentUserName={currentUserName} canEdit={canEdit} onRefresh={onRefresh} />}
      {activeSection === "history" && <ReservasMobilesPanel mode="history" data={data} currentUserName={currentUserName} canEdit={canEdit} onRefresh={onRefresh} />}

      {activeSection === "equipment" && <div className="mobile-section-intro">
        <div><strong>Inventário de equipamentos</strong><span>Use a pesquisa e os filtros rápidos; abra os filtros avançados somente quando necessário.</span></div>
      </div>}

      {activeSection === "equipment" && <div className="mobile-filter-panel" style={{ padding: "18px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px" }}>
        <div className="mobile-filter-primary">
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar Coletor, SN, MAC, App ou versão..." style={inputStyle} />
          <select value={setorFilter} onChange={(event) => setSetorFilter(event.target.value)} style={inputStyle}><option value="">Todos os setores</option>{setores.map((setor) => <option key={setor} value={setor}>{setor}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}><option value="">Todos os status</option>{statusOptions.map((status) => <option key={status} value={status}>{getStatusLabel(status)}</option>)}</select>
          <button type="button" className={showAdvancedFilters || advancedFilterCount > 0 ? "mobile-advanced-filter-button is-active" : "mobile-advanced-filter-button"} onClick={() => setShowAdvancedFilters((current) => !current)} aria-expanded={showAdvancedFilters}>
            {showAdvancedFilters ? "Ocultar filtros" : "Mais filtros"}{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
          </button>
        </div>
        {showAdvancedFilters && <div className="mobile-filter-advanced">
          <select value={setorLocalizadoFilter} onChange={(event) => setSetorLocalizadoFilter(event.target.value)} style={inputStyle}><option value="">Todos os setores localizados</option>{setoresLocalizados.map((setor) => <option key={setor} value={setor}>{setor}</option>)}</select>
          <select value={appFilter} onChange={(event) => setAppFilter(event.target.value)} style={inputStyle}><option value="">Todos os apps</option>{apps.map((app) => <option key={app} value={app}>{app}</option>)}</select>
          <select value={statusAtualizacaoFilter} onChange={(event) => setStatusAtualizacaoFilter(event.target.value)} style={inputStyle}><option value="">Todos os status de atualização</option>{statusAtualizacaoOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <select value={versaoFilter} onChange={(event) => setVersaoFilter(event.target.value)} style={inputStyle}><option value="">{appFilter ? `Todas as versões de ${appFilter}` : "Todas as versões"}</option>{versoes.map((versao) => <option key={versao} value={versao}>{versao}</option>)}</select>
        </div>}
        {appFilter && <div style={{ marginTop: "10px", color: "var(--text-muted)", fontSize: "11px" }}>Os filtros de versão e status de atualização estão sendo aplicados ao App <strong style={{ color: "var(--text-primary)" }}>{appFilter}</strong>.</div>}
        {locationDivergenceOnly && <div style={{ marginTop: "10px", color: "#F59E0B", fontSize: "11px", fontWeight: 600 }}>Filtro rápido ativo: exibindo somente equipamentos Ativos cujo Setor localizado é diferente do Setor de referência.</div>}
        {hasActiveFilters && <div className="mobile-active-filters">
          <span>Filtros ativos:</span>
          {search && <button type="button" onClick={() => setSearch("")}>Pesquisa: {search} ×</button>}
          {setorFilter && <button type="button" onClick={() => setSetorFilter("")}>Setor: {setorFilter} ×</button>}
          {statusFilter && <button type="button" onClick={() => setStatusFilter("")}>Status: {getStatusLabel(statusFilter)} ×</button>}
          {setorLocalizadoFilter && <button type="button" onClick={() => setSetorLocalizadoFilter("")}>Localizado: {setorLocalizadoFilter} ×</button>}
          {appFilter && <button type="button" onClick={() => { setAppFilter(""); setVersaoFilter(""); }}>App: {appFilter} ×</button>}
          {statusAtualizacaoFilter && <button type="button" onClick={() => setStatusAtualizacaoFilter("")}>Atualização: {statusAtualizacaoFilter} ×</button>}
          {versaoFilter && <button type="button" onClick={() => setVersaoFilter("")}>Versão: {versaoFilter} ×</button>}
          {locationDivergenceOnly && <button type="button" onClick={() => setLocationDivergenceOnly(false)}>Fora do setor ×</button>}
          <button type="button" className="mobile-clear-all-filters" onClick={clearFilters}>Limpar todos</button>
        </div>}
      </div>}

      {activeSection === "equipment" && canEdit && selectedRows.length > 0 && <div className="mobile-selection-bar" style={{ padding: "14px 16px", backgroundColor: "var(--bg-secondary)", border: "1px solid #3B82F6", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}><div style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 600 }}>{selectedRows.length} equipamento{selectedRows.length !== 1 ? "s" : ""} selecionado{selectedRows.length !== 1 ? "s" : ""}</div><div style={{ display: "flex", gap: "10px" }}><button type="button" onClick={clearSelection} style={{ padding: "8px 12px", backgroundColor: "var(--bg-primary)", color: "var(--text-muted)", border: "1px solid var(--border-primary)", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Limpar seleção</button><button type="button" onClick={() => setShowBulkUpdateModal(true)} style={{ padding: "8px 14px", backgroundColor: "#3B82F6", color: "#FFFFFF", border: "none", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>Atualizar selecionados</button></div></div>}

      {activeSection === "equipment" && loading && <div style={{ padding: "24px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px", color: "var(--text-muted)", textAlign: "center" }}>Carregando equipamentos...</div>}
      {activeSection === "equipment" && !loading && error && <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "rgba(220, 38, 38, 0.12)", border: "1px solid #DC2626", color: "#DC2626" }}>{error}</div>}
      {activeSection === "equipment" && !loading && !error && data.length <= 1 && <div style={{ padding: "24px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px", color: "var(--text-muted)", textAlign: "center" }}>Nenhum equipamento encontrado na aba tbControleMobiles.</div>}

      {activeSection === "equipment" && !loading && !error && data.length > 1 && <div className="mobile-equipment-section" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px", overflow: "hidden" }}>
        <div className="mobile-equipment-heading" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}><div><strong style={{ color: "var(--text-primary)" }}>Equipamentos cadastrados</strong><span style={{ marginLeft: "10px", color: "var(--text-muted)", fontSize: "12px" }}>{filteredRows.length} de {totalEquipamentos} registros</span></div></div>
        <div className="mobile-equipment-cards">
          {paginatedRows.length === 0 ? (
            <div className="mobile-empty-state">Nenhum equipamento encontrado com os filtros selecionados.</div>
          ) : paginatedRows.map((row, index) => {
            const globalIndex = (currentPage - 1) * itemsPerPage + index;
            const rowIndex = getOriginalIndex(row);
            const summary = getMobileUpdateSummary(row);
            const locatedSector = setorLocalizadoIdx !== -1 ? String(row[setorLocalizadoIdx] || "").trim() : "";
            const referenceSector = setorIdx !== -1 ? String(row[setorIdx] || "").trim() : "";
            const locationDivergent = isLocationDivergent(row);
            return (
              <article className="mobile-equipment-card" key={`card-${row[coletorIdx] || "mobile"}-${row[snIdx] || globalIndex}-${globalIndex}`}>
                <div className="mobile-equipment-card-top">
                  {canEdit && <input aria-label={`Selecionar ${coletorIdx !== -1 ? row[coletorIdx] || "equipamento" : "equipamento"}`} type="checkbox" checked={rowIndex !== null && selectedRows.includes(rowIndex)} onChange={() => handleToggleRow(row)} />}
                  <div className="mobile-equipment-card-title">
                    <strong>{coletorIdx !== -1 ? row[coletorIdx] || "-" : "-"}</strong>
                    <span>{referenceSector || "Setor não informado"}</span>
                  </div>
                  <span style={{ ...getStatusStyle(statusIdx !== -1 ? row[statusIdx] || "" : ""), padding: "5px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700 }}>{statusIdx !== -1 ? getStatusLabel(row[statusIdx] || "") : "Não informado"}</span>
                </div>
                <div className="mobile-equipment-card-grid">
                  <div><span>Localização</span><strong>{locatedSector || "-"}</strong>{locationDivergent && <small>⚠ Fora do setor</small>}</div>
                  <div><span>SN</span><strong>{snIdx !== -1 ? row[snIdx] || "-" : "-"}</strong></div>
                  <div><span>MAC</span><strong>{macIdx !== -1 ? row[macIdx] || "-" : "-"}</strong></div>
                  <div><span>App de uso</span><strong>{appIdx !== -1 ? row[appIdx] || "-" : "-"}</strong></div>
                  <div><span>Apps atualizados</span><strong>{summary.totalApps > 0 ? `${summary.updatedApps} / ${summary.totalApps}` : "Nenhum App"}</strong></div>
                  <div><span>Atualização</span><strong style={{ ...getUpdateStatusStyle(summary.status), padding: "4px 7px", borderRadius: "999px", fontSize: "10px" }}>{summary.status}</strong></div>
                </div>
                <div className="mobile-equipment-card-actions">
                  <button type="button" onClick={() => setViewingAppsRow(row)}>Ver Apps</button>
                  {canEdit && <button type="button" onClick={() => handleEdit(row)}>Editar equipamento</button>}
                </div>
              </article>
            );
          })}
        </div>
        <div className="mobile-equipment-desktop" style={{ width: "100%", overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1320px" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--bg-primary)" }}>
              <th style={{ width: "42px", padding: "12px 10px", textAlign: "center", borderBottom: "1px solid var(--border-primary)" }}>{canEdit && <input type="checkbox" checked={allCurrentPageSelected} onChange={handleToggleCurrentPage} title="Selecionar página atual" style={{ cursor: "pointer" }} />}</th>
              {tableColumns.map((column) => {
                const sortable = Boolean(column.key);
                const activeSort = sortConfig.key === column.key;
                return (
                  <th
                    key={column.title}
                    onClick={() => sortable && handleSort(column.key)}
                    title={sortable ? "Clique para ordenar" : ""}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      color: activeSort ? "var(--text-primary)" : "var(--text-muted)",
                      fontSize: "12px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      borderBottom: "1px solid var(--border-primary)",
                      cursor: sortable ? "pointer" : "default",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      {column.title}
                      {sortable && (
                        <span style={{ fontSize: "10px", opacity: activeSort ? 1 : 0.45 }}>
                          {activeSort ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{paginatedRows.length === 0 ? <tr><td colSpan={11} style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)" }}>Nenhum equipamento encontrado com os filtros selecionados.</td></tr> : paginatedRows.map((row, index) => {
            const globalIndex = (currentPage - 1) * itemsPerPage + index;
            const mobileUpdateSummary = getMobileUpdateSummary(row);
            const locationDivergent = isLocationDivergent(row);
            const locatedSector = setorLocalizadoIdx !== -1 ? String(row[setorLocalizadoIdx] || "").trim() : "";
            return <tr key={`${row[coletorIdx] || "mobile"}-${row[snIdx] || globalIndex}-${globalIndex}`} style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <td style={{ width: "42px", padding: "12px 10px", textAlign: "center" }}>{canEdit && <input type="checkbox" checked={getOriginalIndex(row) !== null && selectedRows.includes(getOriginalIndex(row) as number)} onChange={() => handleToggleRow(row)} style={{ cursor: "pointer" }} />}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-primary)", fontSize: "13px" }}>{setorIdx !== -1 ? row[setorIdx] || "-" : "-"}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-primary)", fontSize: "13px" }}>
                <div>{locatedSector || "-"}</div>
                {locationDivergent && (
                  <span
                    title={`Setor de referência: ${setorIdx !== -1 ? row[setorIdx] || "-" : "-"}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      marginTop: "5px",
                      padding: "3px 7px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(245, 158, 11, 0.14)",
                      color: "#F59E0B",
                      border: "1px solid rgba(245, 158, 11, 0.35)",
                      fontSize: "10px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ⚠ Fora do setor
                  </span>
                )}
              </td>
              <td style={{ padding: "12px 14px", color: "var(--text-primary)", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap" }}>{coletorIdx !== -1 ? row[coletorIdx] || "-" : "-"}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontSize: "12px", whiteSpace: "nowrap" }}>{snIdx !== -1 ? row[snIdx] || "-" : "-"}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontSize: "12px", whiteSpace: "nowrap" }}>{macIdx !== -1 ? row[macIdx] || "-" : "-"}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-primary)", fontSize: "13px", whiteSpace: "nowrap" }}>{appIdx !== -1 ? row[appIdx] || "-" : "-"}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-primary)", fontSize: "13px", whiteSpace: "nowrap" }}>{mobileUpdateSummary.totalApps > 0 ? <><strong>{mobileUpdateSummary.updatedApps}</strong>{" / "}{mobileUpdateSummary.totalApps}</> : <span style={{ color: "var(--text-muted)" }}>Nenhum App</span>}</td>
              <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}><span style={{ display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, ...getUpdateStatusStyle(mobileUpdateSummary.status) }}>{mobileUpdateSummary.status}</span></td>
              <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}><span style={{ display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, ...getStatusStyle(statusIdx !== -1 ? row[statusIdx] || "" : "") }}>{statusIdx !== -1 ? getStatusLabel(row[statusIdx] || "") : "Não informado"}</span></td>
              <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}><div style={{ display: "flex", alignItems: "center", gap: "6px" }}><button type="button" onClick={() => setViewingAppsRow(row)} style={{ padding: "6px 10px", backgroundColor: "var(--bg-primary)", color: "#10B981", border: "1px solid var(--border-primary)", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>Apps</button>{canEdit ? <button type="button" onClick={() => handleEdit(row)} style={{ padding: "6px 10px", backgroundColor: "var(--bg-primary)", color: "#3B82F6", border: "1px solid var(--border-primary)", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>Editar</button> : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Somente leitura</span>}</div></td>
            </tr>;
          })}</tbody>
        </table></div>
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "center", alignItems: "center", gap: "18px", flexWrap: "wrap" }}><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} style={{ padding: "8px 14px", backgroundColor: "var(--bg-primary)", color: currentPage === 1 ? "var(--text-muted)" : "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, opacity: currentPage === 1 ? 0.6 : 1 }}>← Anterior</button><span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Página <strong style={{ color: "var(--text-primary)" }}>{currentPage}</strong> de <strong style={{ color: "var(--text-primary)" }}>{totalPages}</strong></span><button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} style={{ padding: "8px 14px", backgroundColor: "var(--bg-primary)", color: currentPage === totalPages ? "var(--text-muted)" : "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: "8px", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, opacity: currentPage === totalPages ? 0.6 : 1 }}>Próxima →</button></div>
      </div>}

      <DetalhesAppsMobileModal isOpen={viewingAppsRow !== null} coletor={viewingAppsColetor} appRows={viewingApps} mobileApps={mobileApps} mobileConfig={mobileConfig} currentUserName={currentUserName} canEdit={canEdit} onSave={onSaveMobileApp} onClose={() => setViewingAppsRow(null)} />
      <EditarMobileModal isOpen={editingRow !== null} row={editingRow} headers={headers} allRows={rows} mobileApps={mobileApps} mobileConfig={mobileConfig} currentUserName={currentUserName} normalize={normalize} onClose={handleCloseEdit} onSave={onSaveRow} onSaveMobileApp={onSaveMobileApp} onRefresh={onRefresh} />
      <NovoMobileModal isOpen={showCreateModal} headers={headers} allRows={rows} mobileConfig={mobileConfig} currentUserName={currentUserName} normalize={normalize} onClose={() => setShowCreateModal(false)} onCreate={onCreateRow} />
      <AtualizacaoLoteMobilesModal isOpen={showBulkUpdateModal} selectedCount={selectedRows.length} currentUserName={currentUserName} onClose={() => setShowBulkUpdateModal(false)} onApply={handleBulkUpdate} />
    </div>
  );
}
