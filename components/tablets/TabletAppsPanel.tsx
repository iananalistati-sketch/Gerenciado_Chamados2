import React, { useMemo, useState } from "react";
import { apiFetch } from "../../auth/api";
import type { Permissions } from "../../auth/permissions";
import { useAppDialog } from "../../contexts/AppDialogContext";
import { exportRowsToXlsx } from "../../utils/exportXlsx";
import {
  TABLET_SHEETS,
  appUpdateStatus,
  buttonStyle,
  cell,
  getToday,
  headerIndex,
  inputStyle,
  labelStyle,
  normalize,
  originalIndexOf,
  sortText,
  updateStatusColor,
} from "./tabletData";

interface TabletAppsPanelProps {
  tablets: string[][];
  apps: string[][];
  config: string[][];
  permissions: Permissions;
  currentUserName: string;
  onReload: () => void | Promise<void>;
}

const APP_HEADERS = ["COLETOR", "SN", "APP_USO", "VERSAO", "DATA_ATUALIZACAO", "STATUS_ATUALIZACAO", "RESPONSAVEL_ATUALIZACAO", "CONTADOR_ATUALIZACAO", "OBS"];
const CONFIG_HEADERS = ["APP_USO", "VERSAO_ALVO", "LINK_DOWNLOAD_APK", "LINK_SERVIDOR", "LINK_API"];

type AppDraft = { row: string[] | null; tablet: string; app: string; version: string; obs: string };
type ConfigDraft = { row: string[] | null; app: string; target: string; apk: string; server: string; api: string };

export default function TabletAppsPanel({ tablets, apps, config, permissions, currentUserName, onReload }: TabletAppsPanelProps) {
  const { alert: showAlert } = useAppDialog();
  const [view, setView] = useState<"installed" | "targets">("installed");
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appDraft, setAppDraft] = useState<AppDraft | null>(null);
  const [configDraft, setConfigDraft] = useState<ConfigDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const tabletHeaders = tablets[0] || [];
  const tabletRows = tablets.slice(1);
  const tIdx = { tablet: headerIndex(tabletHeaders, "Coletor", "Tablet"), sn: headerIndex(tabletHeaders, "SN"), status: headerIndex(tabletHeaders, "Status"), setor: headerIndex(tabletHeaders, "Setor") };

  const appHeaders = apps[0] || [];
  const appRows = apps.slice(1);
  const aIdx = Object.fromEntries(APP_HEADERS.map((name) => [name, headerIndex(appHeaders, name)])) as Record<string, number>;
  const missingAppHeaders = APP_HEADERS.filter((name) => aIdx[name] === -1);

  const configHeaders = config[0] || [];
  const configRows = config.slice(1);
  const cIdx = Object.fromEntries(CONFIG_HEADERS.map((name) => [name, headerIndex(configHeaders, name)])) as Record<string, number>;
  const missingConfigHeaders = CONFIG_HEADERS.filter((name) => cIdx[name] === -1);

  const targets = useMemo(() => {
    const result: Record<string, string> = {};
    configRows.forEach((row) => {
      const app = cell(row, cIdx.APP_USO);
      if (app) result[normalize(app)] = cell(row, cIdx.VERSAO_ALVO);
    });
    return result;
  }, [configRows, cIdx.APP_USO, cIdx.VERSAO_ALVO]);

  const configuredApps = useMemo(
    () => Array.from(new Set(configRows.map((row) => cell(row, cIdx.APP_USO)).filter(Boolean))).sort(sortText),
    [configRows, cIdx.APP_USO]
  );

  const tabletSector = useMemo(() => {
    const map: Record<string, string> = {};
    tabletRows.forEach((row) => {
      map[normalize(cell(row, tIdx.tablet))] = cell(row, tIdx.setor);
    });
    return map;
  }, [tabletRows, tIdx.tablet, tIdx.setor]);

  const installed = useMemo(() => {
    const query = normalize(search);
    return appRows
      .map((row) => {
        const app = cell(row, aIdx.APP_USO);
        const version = cell(row, aIdx.VERSAO);
        const target = targets[normalize(app)] || "";
        return { row, tablet: cell(row, aIdx.COLETOR), sn: cell(row, aIdx.SN), app, version, target, status: appUpdateStatus(version, target) };
      })
      .filter((item) => item.tablet || item.app)
      .filter((item) => !appFilter || normalize(item.app) === normalize(appFilter))
      .filter((item) => !statusFilter || item.status === statusFilter)
      .filter((item) => !query || [item.tablet, item.sn, item.app, item.version, tabletSector[normalize(item.tablet)]].some((value) => normalize(value).includes(query)))
      .sort((a, b) => sortText(a.tablet, b.tablet) || sortText(a.app, b.app));
  }, [appRows, aIdx, targets, appFilter, statusFilter, search, tabletSector]);

  const pendingCount = installed.filter((item) => item.status === "PENDENTE").length;

  const saveRow = async (sheet: string, row: string[] | null, rowData: string[]) => {
    const rowIndex = row ? originalIndexOf(row) : null;
    if (row && rowIndex === null) throw new Error("Não foi possível identificar a linha original.");
    const response = await apiFetch(row ? "/api/update" : "/api/create", {
      method: row ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row ? { sheet, rowIndex, rowData } : { sheet, rowData }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Erro ao salvar.");
  };

  const submitApp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!appDraft || saving) return;
    const tablet = appDraft.tablet.trim();
    const app = appDraft.app.trim();
    const version = appDraft.version.trim();
    if (!tablet || !app || !version) {
      await showAlert("Informe tablet, app e versão.", { variant: "warning" });
      return;
    }
    const duplicate = appRows.some((row) => row !== appDraft.row && normalize(cell(row, aIdx.COLETOR)) === normalize(tablet) && normalize(cell(row, aIdx.APP_USO)) === normalize(app));
    if (duplicate) {
      await showAlert(`O app ${app} já está registrado para o tablet ${tablet}. Use "Atualizar versão".`, { variant: "warning" });
      return;
    }

    const tabletRow = tabletRows.find((row) => normalize(cell(row, tIdx.tablet)) === normalize(tablet));
    const base = appDraft.row ? [...appDraft.row] : new Array(appHeaders.length).fill("");
    while (base.length < appHeaders.length) base.push("");
    const versionChanged = !appDraft.row || normalize(cell(appDraft.row, aIdx.VERSAO)) !== normalize(version);

    base[aIdx.COLETOR] = tablet;
    base[aIdx.SN] = cell(tabletRow, tIdx.sn) || cell(appDraft.row || undefined, aIdx.SN);
    base[aIdx.APP_USO] = app;
    base[aIdx.VERSAO] = version;
    base[aIdx.STATUS_ATUALIZACAO] = appUpdateStatus(version, targets[normalize(app)] || "");
    base[aIdx.OBS] = appDraft.obs.trim();
    if (versionChanged) {
      base[aIdx.DATA_ATUALIZACAO] = getToday();
      base[aIdx.RESPONSAVEL_ATUALIZACAO] = currentUserName;
      const counter = Number(String(cell(appDraft.row || undefined, aIdx.CONTADOR_ATUALIZACAO) || "0").replace(",", ".")) || 0;
      base[aIdx.CONTADOR_ATUALIZACAO] = String(counter + 1);
    }

    setSaving(true);
    try {
      await saveRow(TABLET_SHEETS.apps, appDraft.row, base);
      setAppDraft(null);
      await Promise.resolve(onReload());
    } catch (error: any) {
      await showAlert("Erro ao salvar o app: " + (error?.message || "Erro desconhecido"), { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const submitConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!configDraft || saving) return;
    const app = configDraft.app.trim().toUpperCase();
    const target = configDraft.target.trim();
    if (!app || !target) {
      await showAlert("Informe o app e a versão-alvo.", { variant: "warning" });
      return;
    }
    if (configRows.some((row) => row !== configDraft.row && normalize(cell(row, cIdx.APP_USO)) === normalize(app))) {
      await showAlert(`O app ${app} já possui versão-alvo cadastrada.`, { variant: "warning" });
      return;
    }
    const base = configDraft.row ? [...configDraft.row] : new Array(configHeaders.length).fill("");
    while (base.length < configHeaders.length) base.push("");
    base[cIdx.APP_USO] = app;
    base[cIdx.VERSAO_ALVO] = target;
    base[cIdx.LINK_DOWNLOAD_APK] = configDraft.apk.trim();
    base[cIdx.LINK_SERVIDOR] = configDraft.server.trim();
    base[cIdx.LINK_API] = configDraft.api.trim();

    setSaving(true);
    try {
      await saveRow(TABLET_SHEETS.config, configDraft.row, base);
      setConfigDraft(null);
      await Promise.resolve(onReload());
    } catch (error: any) {
      await showAlert("Erro ao salvar a versão-alvo: " + (error?.message || "Erro desconhecido"), { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const exportInstalled = () =>
    exportRowsToXlsx(
      `tablets-apps-${getToday()}.xlsx`,
      "Apps dos tablets",
      [
        { header: "Tablet", width: 20, value: (item: typeof installed[number]) => item.tablet },
        { header: "SN", width: 18, value: (item) => item.sn },
        { header: "Setor", width: 22, value: (item) => tabletSector[normalize(item.tablet)] || "" },
        { header: "App", width: 18, value: (item) => item.app },
        { header: "Versão", width: 14, value: (item) => item.version },
        { header: "Versão-alvo", width: 14, value: (item) => item.target },
        { header: "Status", width: 16, value: (item) => item.status },
        { header: "Data atualização", width: 16, value: (item) => cell(item.row, aIdx.DATA_ATUALIZACAO) },
        { header: "Responsável", width: 26, value: (item) => cell(item.row, aIdx.RESPONSAVEL_ATUALIZACAO) },
      ],
      installed
    );

  const missingMessage = (sheet: string, missing: string[]) => (
    <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#EF4444", fontSize: "12px" }}>
      A aba <strong>{sheet}</strong> não possui as colunas: {missing.join(", ")}.
    </div>
  );

  const thStyle: React.CSSProperties = { padding: "10px 12px", textAlign: "left", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, borderBottom: "1px solid var(--border-primary)", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--border-primary)", fontSize: "12px", color: "var(--text-primary)", verticalAlign: "top" };
  const tabStyle = (active: boolean): React.CSSProperties => ({ ...buttonStyle("secondary"), border: active ? "1px solid #3B82F6" : "1px solid var(--border-primary)", color: active ? "#3B82F6" : "var(--text-primary)" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="mobile-section-intro">
        <div>
          <strong>Apps e versões dos tablets</strong>
          <span>Registre os apps instalados em cada tablet e acompanhe as pendências em relação à versão-alvo.</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => setView("installed")} style={tabStyle(view === "installed")}>Apps instalados</button>
        <button type="button" onClick={() => setView("targets")} style={tabStyle(view === "targets")}>Versões-alvo</button>
      </div>

      {view === "installed" ? (
        missingAppHeaders.length > 0 ? missingMessage(TABLET_SHEETS.apps, missingAppHeaders) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) repeat(2, minmax(0, 1fr)) auto", gap: "10px", alignItems: "center" }} className="mobile-filter-primary">
              <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar tablet, SN, setor, app ou versão..." style={inputStyle} />
              <select value={appFilter} onChange={(event) => setAppFilter(event.target.value)} style={inputStyle}>
                <option value="">Todos os apps</option>
                {configuredApps.map((app) => <option key={app} value={app}>{app}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
                <option value="">Todos os status</option>
                <option value="ATUALIZADO">Atualizado</option>
                <option value="PENDENTE">Pendente</option>
                <option value="SEM INFORMAÇÃO">Sem informação</option>
              </select>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={exportInstalled} disabled={installed.length === 0} style={buttonStyle("secondary")}>Exportar</button>
                {permissions.canManageTabletApps && (
                  <button type="button" onClick={() => setAppDraft({ row: null, tablet: "", app: "", version: "", obs: "" })} style={buttonStyle("primary")}>+ Registrar app</button>
                )}
              </div>
            </div>

            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              {installed.length} registro(s) · <strong style={{ color: "#F59E0B" }}>{pendingCount} pendente(s)</strong>
            </div>

            <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px", overflowX: "auto" }}>
              {installed.length === 0 ? (
                <div style={{ padding: "30px 20px", color: "var(--text-muted)", textAlign: "center", fontSize: "13px" }}>Nenhum app registrado{search || appFilter || statusFilter ? " para os filtros aplicados" : ""}.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{["Tablet", "Setor", "App", "Versão", "Versão-alvo", "Status", "Atualização", "Responsável", ""].map((title) => <th key={title} style={thStyle}>{title}</th>)}</tr>
                  </thead>
                  <tbody>
                    {installed.map((item, index) => (
                      <tr key={`${item.tablet}-${item.app}-${index}`}>
                        <td style={tdStyle}><strong>{item.tablet || "-"}</strong><div style={{ color: "var(--text-muted)", fontSize: "10px" }}>SN {item.sn || "-"}</div></td>
                        <td style={tdStyle}>{tabletSector[normalize(item.tablet)] || "-"}</td>
                        <td style={tdStyle}>{item.app || "-"}</td>
                        <td style={tdStyle}>{item.version || "-"}</td>
                        <td style={tdStyle}>{item.target || "-"}</td>
                        <td style={{ ...tdStyle, color: updateStatusColor(item.status), fontWeight: 700 }}>{item.status}</td>
                        <td style={tdStyle}>{cell(item.row, aIdx.DATA_ATUALIZACAO) || "-"}<div style={{ color: "var(--text-muted)", fontSize: "10px" }}>{cell(item.row, aIdx.CONTADOR_ATUALIZACAO) ? `${cell(item.row, aIdx.CONTADOR_ATUALIZACAO)} atualização(ões)` : ""}</div></td>
                        <td style={tdStyle}>{cell(item.row, aIdx.RESPONSAVEL_ATUALIZACAO) || "-"}</td>
                        <td style={tdStyle}>
                          {permissions.canManageTabletApps && (
                            <button type="button" onClick={() => setAppDraft({ row: item.row, tablet: item.tablet, app: item.app, version: item.version, obs: cell(item.row, aIdx.OBS) })} style={{ ...buttonStyle("accent"), padding: "6px 10px", fontSize: "11px" }}>Atualizar versão</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )
      ) : missingConfigHeaders.length > 0 ? missingMessage(TABLET_SHEETS.config, missingConfigHeaders) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>A versão-alvo define quando um app instalado está ATUALIZADO ou PENDENTE.</span>
            {permissions.canManageTabletConfig && (
              <button type="button" onClick={() => setConfigDraft({ row: null, app: "", target: "", apk: "", server: "", api: "" })} style={buttonStyle("primary")}>+ Nova versão-alvo</button>
            )}
          </div>
          <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "12px", overflowX: "auto" }}>
            {configRows.filter((row) => cell(row, cIdx.APP_USO)).length === 0 ? (
              <div style={{ padding: "30px 20px", color: "var(--text-muted)", textAlign: "center", fontSize: "13px" }}>Nenhuma versão-alvo cadastrada.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["App", "Versão-alvo", "APK", "Servidor", "API", ""].map((title) => <th key={title} style={thStyle}>{title}</th>)}</tr>
                </thead>
                <tbody>
                  {configRows.filter((row) => cell(row, cIdx.APP_USO)).sort((a, b) => sortText(cell(a, cIdx.APP_USO), cell(b, cIdx.APP_USO))).map((row, index) => (
                    <tr key={`${cell(row, cIdx.APP_USO)}-${index}`}>
                      <td style={tdStyle}><strong>{cell(row, cIdx.APP_USO)}</strong></td>
                      <td style={tdStyle}>{cell(row, cIdx.VERSAO_ALVO) || "-"}</td>
                      <td style={tdStyle}>{cell(row, cIdx.LINK_DOWNLOAD_APK) ? <a href={cell(row, cIdx.LINK_DOWNLOAD_APK)} target="_blank" rel="noreferrer" style={{ color: "#3B82F6" }}>Abrir</a> : "-"}</td>
                      <td style={{ ...tdStyle, overflowWrap: "anywhere" }}>{cell(row, cIdx.LINK_SERVIDOR) || "-"}</td>
                      <td style={{ ...tdStyle, overflowWrap: "anywhere" }}>{cell(row, cIdx.LINK_API) || "-"}</td>
                      <td style={tdStyle}>
                        {permissions.canManageTabletConfig && (
                          <button type="button" onClick={() => setConfigDraft({ row, app: cell(row, cIdx.APP_USO), target: cell(row, cIdx.VERSAO_ALVO), apk: cell(row, cIdx.LINK_DOWNLOAD_APK), server: cell(row, cIdx.LINK_SERVIDOR), api: cell(row, cIdx.LINK_API) })} style={{ ...buttonStyle("accent"), padding: "6px 10px", fontSize: "11px" }}>Editar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {appDraft && (
        <SimpleModal title={appDraft.row ? "Atualizar versão do app" : "Registrar app no tablet"} saving={saving} onClose={() => setAppDraft(null)} onSubmit={submitApp}>
          <label style={labelStyle}>
            Tablet *
            <select value={appDraft.tablet} onChange={(event) => setAppDraft({ ...appDraft, tablet: event.target.value })} disabled={Boolean(appDraft.row)} style={inputStyle}>
              <option value="">Selecione</option>
              {Array.from(new Set(
                tabletRows
                  .filter((row) => cell(row, tIdx.tablet) && cell(row, tIdx.status).toUpperCase() !== "I")
                  .map((row) => cell(row, tIdx.tablet))
                  .concat(appDraft.row && appDraft.tablet ? [appDraft.tablet] : [])
              ))
                .sort(sortText)
                .map((tablet) => <option key={tablet} value={tablet}>{tablet}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            App *
            <select value={appDraft.app} onChange={(event) => setAppDraft({ ...appDraft, app: event.target.value })} disabled={Boolean(appDraft.row)} style={inputStyle}>
              <option value="">Selecione</option>
              {configuredApps.map((app) => <option key={app} value={app}>{app}</option>)}
              {appDraft.row && !configuredApps.some((app) => normalize(app) === normalize(appDraft.app)) && <option value={appDraft.app}>{appDraft.app}</option>}
            </select>
            {configuredApps.length === 0 && <span style={{ color: "#F59E0B", fontSize: "11px", fontWeight: 500 }}>Cadastre primeiro o app em "Versões-alvo".</span>}
          </label>
          <label style={labelStyle}>
            Versão instalada *
            <input type="text" value={appDraft.version} onChange={(event) => setAppDraft({ ...appDraft, version: event.target.value })} placeholder={targets[normalize(appDraft.app)] ? `Alvo: ${targets[normalize(appDraft.app)]}` : ""} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Observação
            <textarea value={appDraft.obs} onChange={(event) => setAppDraft({ ...appDraft, obs: event.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </label>
        </SimpleModal>
      )}

      {configDraft && (
        <SimpleModal title={configDraft.row ? "Editar versão-alvo" : "Nova versão-alvo"} saving={saving} onClose={() => setConfigDraft(null)} onSubmit={submitConfig}>
          <label style={labelStyle}>
            App *
            <input type="text" value={configDraft.app} onChange={(event) => setConfigDraft({ ...configDraft, app: event.target.value })} disabled={Boolean(configDraft.row)} placeholder="Ex.: ASSISTENCIAL" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Versão-alvo *
            <input type="text" value={configDraft.target} onChange={(event) => setConfigDraft({ ...configDraft, target: event.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Link do APK
            <input type="url" value={configDraft.apk} onChange={(event) => setConfigDraft({ ...configDraft, apk: event.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Link do servidor
            <input type="text" value={configDraft.server} onChange={(event) => setConfigDraft({ ...configDraft, server: event.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Link da API
            <input type="text" value={configDraft.api} onChange={(event) => setConfigDraft({ ...configDraft, api: event.target.value })} style={inputStyle} />
          </label>
        </SimpleModal>
      )}
    </div>
  );
}

function SimpleModal({
  title,
  saving,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mobile-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", zIndex: 1200 }}>
      <div className="mobile-modal-card" style={{ width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <form onSubmit={onSubmit}>
          <div className="mobile-modal-header" style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "18px" }}>{title}</h2>
            <button type="button" onClick={onClose} disabled={saving} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontSize: "18px" }}>×</button>
          </div>
          <div className="mobile-modal-grid" style={{ padding: "20px 22px", display: "grid", gap: "14px" }}>{children}</div>
          <div className="mobile-modal-footer" style={{ padding: "14px 22px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} disabled={saving} style={buttonStyle("secondary")}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ ...buttonStyle("primary"), opacity: saving ? 0.65 : 1 }}>{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
