import { useMemo, useState } from "react";
import { exportRowsToXlsx } from "../utils/exportXlsx";
import { loanRowToTermData, type MobileLoanTermData } from "./mobileLoanTermData";

interface MobileLoanHistoryProps {
  headers: string[];
  rows: string[][];
  loading: boolean;
  getCurrentLocation: (collector: string) => string;
  onOpenTerm: (type: "loan" | "return", data: MobileLoanTermData) => void;
}

type HistoryItem = { row: string[]; data: MobileLoanTermData; currentLocation: string };
type SortDirection = "asc" | "desc";

interface HistoryColumn {
  key: string;
  label: string;
  width?: number;
  value: (item: HistoryItem) => string;
  sortValue?: (item: HistoryItem) => string;
}

const normalize = (value: string) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const dateKey = (value: string) => {
  const iso = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : "";
};

const formatDate = (value: string) => {
  const key = dateKey(value);
  if (!key) return value || "—";
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
};

const columns: HistoryColumn[] = [
  { key: "loanId", label: "ID do empréstimo", width: 22, value: ({ data }) => data.loanId },
  { key: "status", label: "Status", width: 14, value: ({ data }) => data.status },
  { key: "reserveCollector", label: "Coletor reserva", width: 20, value: ({ data }) => data.reserveCollector },
  { key: "reserveSerial", label: "SN reserva", width: 18, value: ({ data }) => data.reserveSerial },
  { key: "originalCollector", label: "Coletor substituído", width: 22, value: ({ data }) => data.originalCollector },
  { key: "originalSerial", label: "SN substituído", width: 18, value: ({ data }) => data.originalSerial },
  { key: "destinationSector", label: "Setor de destino", width: 22, value: ({ data }) => data.destinationSector },
  { key: "currentLocation", label: "Localização atual", width: 22, value: ({ currentLocation }) => currentLocation },
  { key: "serviceOrder", label: "Ordem de serviço", width: 18, value: ({ data }) => data.serviceOrder },
  { key: "loanDate", label: "Data do empréstimo", width: 18, value: ({ data }) => formatDate(data.loanDate), sortValue: ({ data }) => dateKey(data.loanDate) },
  { key: "returnDate", label: "Data da devolução", width: 18, value: ({ data }) => formatDate(data.returnDate), sortValue: ({ data }) => dateKey(data.returnDate) },
  { key: "loanResponsible", label: "Técnico do empréstimo", width: 28, value: ({ data }) => data.loanResponsible },
  { key: "returnResponsible", label: "Técnico da devolução", width: 28, value: ({ data }) => data.returnResponsible },
  { key: "loanCollaboratorName", label: "Colaborador do empréstimo", width: 28, value: ({ data }) => data.loanCollaboratorName },
  { key: "loanCollaboratorRegistration", label: "Matrícula do empréstimo", width: 20, value: ({ data }) => data.loanCollaboratorRegistration },
  { key: "loanCollaboratorRole", label: "Cargo no empréstimo", width: 24, value: ({ data }) => data.loanCollaboratorRole },
  { key: "returnCollaboratorName", label: "Colaborador da devolução", width: 28, value: ({ data }) => data.returnCollaboratorName },
  { key: "returnCollaboratorRegistration", label: "Matrícula da devolução", width: 20, value: ({ data }) => data.returnCollaboratorRegistration },
  { key: "returnCollaboratorRole", label: "Cargo na devolução", width: 24, value: ({ data }) => data.returnCollaboratorRole },
  { key: "reason", label: "Motivo", width: 30, value: ({ data }) => data.reason },
  { key: "observation", label: "Observação do empréstimo", width: 34, value: ({ data }) => data.observation },
  { key: "returnCondition", label: "Condição da devolução", width: 26, value: ({ data }) => data.returnCondition },
  { key: "returnDetails", label: "Defeitos/peças faltantes", width: 34, value: ({ data }) => data.returnDetails },
  { key: "returnObservation", label: "Observação da devolução", width: 34, value: ({ data }) => data.returnObservation },
];

const defaultColumns = [
  "loanId", "status", "reserveCollector", "originalCollector", "destinationSector",
  "serviceOrder", "loanDate", "returnDate", "loanResponsible",
];

export default function MobileLoanHistory({
  headers,
  rows,
  loading,
  getCurrentLocation,
  onOpenTerm,
}: MobileLoanHistoryProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sector, setSector] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>(defaultColumns);
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: "loanDate", direction: "desc" });

  const items = useMemo(() => rows.map((row) => {
    const data = loanRowToTermData(headers, row);
    return { row, data, currentLocation: getCurrentLocation(data.reserveCollector) };
  }), [getCurrentLocation, headers, rows]);

  const sectors = useMemo(() => Array.from(new Set<string>(items.map(({ data }) => data.destinationSector).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })), [items]);

  const visibleColumns = columns.filter((column) => selectedKeys.includes(column.key));
  const filteredItems = useMemo(() => {
    const term = normalize(search);
    return items.filter((item) => {
      if (status && normalize(item.data.status) !== normalize(status)) return false;
      if (sector && normalize(item.data.destinationSector) !== normalize(sector)) return false;
      const loanDate = dateKey(item.data.loanDate);
      if (startDate && (!loanDate || loanDate < startDate)) return false;
      if (endDate && (!loanDate || loanDate > endDate)) return false;
      if (term && !columns.some((column) => normalize(column.value(item)).includes(term))) return false;
      return true;
    });
  }, [endDate, items, search, sector, startDate, status]);

  const sortedItems = useMemo(() => {
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return filteredItems;
    return [...filteredItems].sort((first, second) => {
      const comparison = (column.sortValue?.(first) || column.value(first)).localeCompare(
        column.sortValue?.(second) || column.value(second),
        "pt-BR",
        { numeric: true, sensitivity: "base" }
      );
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredItems, sort]);

  const toggleSort = (key: string) => setSort((previous) => ({
    key,
    direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc",
  }));

  const toggleColumn = (key: string) => setSelectedKeys((previous) =>
    previous.includes(key)
      ? previous.length === 1 ? previous : previous.filter((item) => item !== key)
      : [...previous, key]
  );

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setSector("");
    setStartDate("");
    setEndDate("");
  };

  const exportHistory = () => exportRowsToXlsx(
    `historico-emprestimos-${new Date().toISOString().slice(0, 10)}.xlsx`,
    "Histórico de empréstimos",
    visibleColumns.map((column) => ({ header: column.label, width: column.width, value: column.value })),
    sortedItems
  );

  return (
    <section className="mobile-loan-history">
      <div className="mobile-history-heading">
        <div>
          <strong>Histórico de empréstimos</strong>
          <span>{sortedItems.length} de {items.length} registro{items.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mobile-history-actions">
          <details className="mobile-history-columns">
            <summary>Colunas ({selectedKeys.length})</summary>
            <div>
              <span>Escolha o que será exibido e exportado</span>
              <div className="mobile-history-column-shortcuts">
                <button type="button" onClick={() => setSelectedKeys(columns.map((column) => column.key))}>Todas</button>
                <button type="button" onClick={() => setSelectedKeys(defaultColumns)}>Padrão</button>
              </div>
              {columns.map((column) => (
                <label key={column.key}>
                  <input type="checkbox" checked={selectedKeys.includes(column.key)} onChange={() => toggleColumn(column.key)} />
                  {column.label}
                </label>
              ))}
            </div>
          </details>
          <button type="button" className="mobile-history-export" onClick={exportHistory} disabled={sortedItems.length === 0}>Exportar Excel</button>
        </div>
      </div>

      <div className="mobile-history-filters">
        <label className="mobile-history-search"><span>Pesquisa geral</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, coletor, colaborador, OS..." /></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="ABERTO">Aberto</option><option value="FINALIZADO">Finalizado</option></select></label>
        <label><span>Setor de destino</span><select value={sector} onChange={(event) => setSector(event.target.value)}><option value="">Todos os setores</option>{sectors.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Empréstimo a partir de</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label><span>Empréstimo até</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <button type="button" onClick={clearFilters}>Limpar filtros</button>
      </div>

      <div className="mobile-history-table-wrap">
        <table style={{ minWidth: `${Math.max(860, visibleColumns.length * 155)}px` }}>
          <thead><tr>
            {visibleColumns.map((column) => {
              const active = sort.key === column.key;
              return <th key={column.key} onClick={() => toggleSort(column.key)} title="Clique para ordenar">
                <span>{column.label}<i>{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</i></span>
              </th>;
            })}
            <th>Ações</th>
          </tr></thead>
          <tbody>
            {sortedItems.length === 0 ? <tr><td colSpan={visibleColumns.length + 1} className="mobile-history-empty">{loading ? "Carregando empréstimos..." : "Nenhum empréstimo encontrado com os filtros selecionados."}</td></tr> : sortedItems.map((item, index) => {
              const finalized = normalize(item.data.status) === "finalizado";
              return <tr key={item.data.loanId || `${item.data.reserveCollector}-${index}`}>
                {visibleColumns.map((column) => <td key={column.key}>{column.value(item) || "—"}</td>)}
                <td><div className="mobile-history-term-actions">
                  <button type="button" onClick={() => onOpenTerm("loan", item.data)}>Empréstimo</button>
                  {finalized && item.data.returnDate && <button type="button" onClick={() => onOpenTerm("return", item.data)}>Devolução</button>}
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
