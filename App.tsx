import React, { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./components/Login";
import ChangePassword from "./components/ChangePassword";
import UserManagement from "./components/UserManagement";
import Dashboard from "./components/Dashboard";
import ChamadosTable from "./components/ChamadosTable";
import ControleMobiles from "./components/ControleMobiles";
import MobileTargetVersionsManager from "./components/MobileTargetVersionsManager";
import CobrancaModal from "./components/CobrancaModal";
import ConcluirModal from "./components/ConcluirModal";
import FiltroModal from "./components/FiltroModal";
import { useAuth } from "./contexts/AuthContext";
import {
  canManageUsers,
  canViewUserManagement,
  canEditMobileControl,
  canManageMobileTargetVersions,
} from "./auth/permissions";

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const App: React.FC = () => {
  const {
    user,
    loading: authLoading,
    role,
    mustChangePassword,
    logout,
  } = useAuth();

  const [selectedSheet, setSelectedSheet] = useState("MV");
  const [data, setData] = useState<string[][]>([]);
  const [mobileConfig, setMobileConfig] = useState<string[][]>([]);
  const [mobileApps, setMobileApps] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cobrancaRow, setCobrancaRow] = useState<string[] | null>(null);
  const [concluirRow, setConcluirRow] = useState<string[] | null>(null);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [mobileVersionsOpen, setMobileVersionsOpen] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    gravidade: "",
    responsavel: "",
    cobranca: "",
    excluido: "NAO",
    dataAberturaInicio: "",
    dataAberturaFim: "",
    ultimaInteracaoInicio: "",
    ultimaInteracaoFim: "",
  });

  const currentUserName = user?.email || "";
  const canEditMobiles = canEditMobileControl(role);
  const canManageMobileVersions = canManageMobileTargetVersions(role);

  const fetchData = useCallback(async () => {
    if (!selectedSheet) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/data?sheet=${encodeURIComponent(selectedSheet)}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Erro ao carregar dados.");
      }

      const safeData = Array.isArray(result)
        ? result.filter((row) => Array.isArray(row))
        : [];

      safeData.forEach((row, index) => {
        if (index > 0) {
          (row as any)._originalIndex = index + 1;
        }
      });

      setData(safeData);
    } catch (err: any) {
      console.error("Erro ao carregar dados:", err);
      setError(err.message || "Erro ao carregar dados.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSheet]);

  const fetchMobileConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/data?sheet=tbConfigMobiles");
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Erro ao carregar configurações de mobiles.");
      setMobileConfig(Array.isArray(result) ? result.filter((row) => Array.isArray(row)) : []);
    } catch (err) {
      console.error("Erro ao carregar tbConfigMobiles:", err);
      setMobileConfig([]);
    }
  }, []);

  const fetchMobileApps = useCallback(async () => {
    try {
      const response = await fetch("/api/data?sheet=tbMobileApps");
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Erro ao carregar apps dos mobiles.");
      const safeData = Array.isArray(result) ? result.filter((row) => Array.isArray(row)) : [];
      safeData.forEach((row, index) => {
        if (index > 0) {
          (row as any)._originalIndex = index + 1;
        }
      });
      setMobileApps(safeData);
    } catch (err) {
      console.error("Erro ao carregar tbMobileApps:", err);
      setMobileApps([]);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) return;
    fetchMobileConfig();
    fetchMobileApps();
  }, [user, fetchMobileConfig, fetchMobileApps]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchData(), fetchMobileConfig(), fetchMobileApps()]);
  }, [fetchData, fetchMobileConfig, fetchMobileApps]);

  const handleUpdateRow = useCallback(
    async (rowData: string[], rowIndex: number) => {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: selectedSheet,
          rowIndex,
          rowData,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Erro ao atualizar registro.");
      }

      await fetchData();
    },
    [selectedSheet, fetchData]
  );

  const handleSaveMobileApp = useCallback(
    async (rowData: string[], rowIndex: number) => {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: "tbMobileApps",
          rowIndex,
          rowData,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Erro ao atualizar App do mobile.");
      }

      await fetchMobileApps();
    },
    [fetchMobileApps]
  );

  const handleCreateRow = useCallback(
    async (rowData: string[]) => {
      const response = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: selectedSheet,
          rowData,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Erro ao criar registro.");
      }

      await handleRefresh();
    },
    [selectedSheet, handleRefresh]
  );

  const handleBulkUpdate = useCallback(
    async (
      updates: Array<{
        rowIndex: number;
        rowData: string[];
      }>
    ) => {
      for (const update of updates) {
        const response = await fetch("/api/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheet: selectedSheet,
            rowIndex: update.rowIndex,
            rowData: update.rowData,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "Erro ao atualizar registro em lote.");
        }
      }
      await fetchData();
    },
    [selectedSheet, fetchData]
  );

  const headers = data[0] || [];
  const rows = data.slice(1);

  const filteredRows = useMemo(() => {
    if (!rows.length) return [];

    const getIndex = (...names: string[]) =>
      headers.findIndex((header) =>
        names.some((name) => normalize(header) === normalize(name))
      );

    const tituloIdx = getIndex("Título", "Titulo");
    const descricaoIdx = getIndex("Descrição", "Descricao");
    const situacaoIdx = getIndex("Situação", "Situacao");
    const gravidadeIdx = getIndex("Gravidade");
    const responsavelIdx = getIndex("Responsável", "Responsavel");
    const cobrancaIdx = getIndex("Cobrança", "Cobranca");
    const excluidoIdx = getIndex("Excluído", "Excluido");
    const aberturaIdx = getIndex("Abertura", "Data Abertura");
    const ultimaInteracaoIdx = getIndex("Última Interação", "Ultima Interacao");

    const parseDate = (value: string) => {
      const text = String(value || "").trim();
      if (!text) return null;
      const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
      const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const parseInputDate = (value: string, endOfDay = false) => {
      if (!value) return null;
      const [year, month, day] = value.split("-").map(Number);
      if (!year || !month || !day) return null;
      return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    };

    const search = normalize(filters.search);
    const openingStart = parseInputDate(filters.dataAberturaInicio);
    const openingEnd = parseInputDate(filters.dataAberturaFim, true);
    const interactionStart = parseInputDate(filters.ultimaInteracaoInicio);
    const interactionEnd = parseInputDate(filters.ultimaInteracaoFim, true);

    return rows.filter((row) => {
      if (search) {
        const haystack = [
          tituloIdx !== -1 ? row[tituloIdx] : "",
          descricaoIdx !== -1 ? row[descricaoIdx] : "",
        ]
          .map((value) => normalize(value || ""))
          .join(" ");
        if (!haystack.includes(search)) return false;
      }

      if (filters.status && situacaoIdx !== -1 && normalize(row[situacaoIdx] || "") !== normalize(filters.status)) return false;
      if (filters.gravidade && gravidadeIdx !== -1 && normalize(row[gravidadeIdx] || "") !== normalize(filters.gravidade)) return false;
      if (filters.responsavel && responsavelIdx !== -1 && normalize(row[responsavelIdx] || "") !== normalize(filters.responsavel)) return false;
      if (filters.cobranca && cobrancaIdx !== -1 && normalize(row[cobrancaIdx] || "") !== normalize(filters.cobranca)) return false;
      if (filters.excluido && excluidoIdx !== -1 && normalize(row[excluidoIdx] || "") !== normalize(filters.excluido)) return false;

      if ((openingStart || openingEnd) && aberturaIdx !== -1) {
        const date = parseDate(row[aberturaIdx] || "");
        if (!date) return false;
        if (openingStart && date < openingStart) return false;
        if (openingEnd && date > openingEnd) return false;
      }

      if ((interactionStart || interactionEnd) && ultimaInteracaoIdx !== -1) {
        const date = parseDate(row[ultimaInteracaoIdx] || "");
        if (!date) return false;
        if (interactionStart && date < interactionStart) return false;
        if (interactionEnd && date > interactionEnd) return false;
      }

      return true;
    });
  }, [rows, headers, filters]);

  if (authLoading) {
    return <div style={{ padding: "40px", color: "var(--text-primary)" }}>Carregando...</div>;
  }

  if (!user) {
    return <Login />;
  }

  if (mustChangePassword) {
    return <ChangePassword />;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-primary)", backgroundColor: "var(--bg-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px" }}>Gestor de Chamados</h1>
          <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--text-muted)" }}>{currentUserName}</div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {canViewUserManagement(role) && (
            <button type="button" onClick={() => setUserManagementOpen(true)} style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer" }}>Usuários</button>
          )}
          {canManageMobileVersions && selectedSheet === "tbControleMobiles" && (
            <button type="button" onClick={() => setMobileVersionsOpen(true)} style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer" }}>⚙ Versões Alvo</button>
          )}
          <button type="button" onClick={logout} style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer" }}>Sair</button>
        </div>
      </header>

      <main style={{ padding: "20px" }}>
        <div style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {['MV', 'ForHealth', 'tbControleMobiles'].map((sheet) => (
            <button key={sheet} type="button" onClick={() => setSelectedSheet(sheet)} style={{ padding: "10px 14px", borderRadius: "8px", border: selectedSheet === sheet ? "1px solid #3B82F6" : "1px solid var(--border-primary)", backgroundColor: selectedSheet === sheet ? "rgba(59, 130, 246, 0.12)" : "var(--bg-secondary)", color: selectedSheet === sheet ? "#3B82F6" : "var(--text-primary)", cursor: "pointer", fontWeight: 600 }}>{sheet === 'tbControleMobiles' ? 'Controle de Mobiles' : sheet}</button>
          ))}
        </div>

        {selectedSheet === "tbControleMobiles" ? (
          <ControleMobiles
            data={data}
            mobileConfig={mobileConfig}
            mobileApps={mobileApps}
            loading={loading}
            error={error}
            currentUserName={currentUserName}
            canEdit={canEditMobiles}
            onRefresh={handleRefresh}
            onSaveRow={handleUpdateRow}
            onSaveMobileApp={handleSaveMobileApp}
            onCreateRow={handleCreateRow}
            onBulkUpdate={handleBulkUpdate}
          />
        ) : (
          <>
            <Dashboard data={data} />
            <div style={{ marginTop: "20px" }}>
              <ChamadosTable
                data={[headers, ...filteredRows]}
                loading={loading}
                error={error}
                sheet={selectedSheet}
                onRefresh={fetchData}
                onOpenFilters={() => setFiltersOpen(true)}
                onCobranca={(row) => setCobrancaRow(row)}
                onConcluir={(row) => setConcluirRow(row)}
              />
            </div>
          </>
        )}
      </main>

      <FiltroModal isOpen={filtersOpen} filters={filters} data={data} onClose={() => setFiltersOpen(false)} onApply={setFilters} />
      <CobrancaModal isOpen={cobrancaRow !== null} row={cobrancaRow} headers={headers} onClose={() => setCobrancaRow(null)} onSaved={fetchData} />
      <ConcluirModal isOpen={concluirRow !== null} row={concluirRow} headers={headers} sheet={selectedSheet} onClose={() => setConcluirRow(null)} onSaved={fetchData} />

      {userManagementOpen && canViewUserManagement(role) && (
        <UserManagement onClose={() => setUserManagementOpen(false)} canManage={canManageUsers(role)} />
      )}

      {mobileVersionsOpen && canManageMobileVersions && (
        <MobileTargetVersionsManager
          isOpen={mobileVersionsOpen}
          mobileConfig={mobileConfig}
          onClose={() => setMobileVersionsOpen(false)}
          onSaved={async () => {
            await fetchMobileConfig();
          }}
        />
      )}
    </div>
  );
};

export default App;
