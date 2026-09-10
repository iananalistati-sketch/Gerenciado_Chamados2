import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../auth/api";

const normalize = (value: string) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const isHttpUrl = (value: string) => { try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; } };
const findMobileSheetSelect = () => Array.from(document.querySelectorAll("select")).find((select) => Array.from(select.options).some((option) => option.value === "tbControleMobiles")) as HTMLSelectElement | undefined;

type AccessLink = { key: "apk" | "server" | "api"; label: string; link: string };

export default function MobileTargetVersionsManager() {
  const { role } = useAuth();
  const [isMobileTab, setIsMobileTab] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<string[][]>([]);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [appUso, setAppUso] = useState("");
  const [versaoAlvo, setVersaoAlvo] = useState("");
  const [linkApk, setLinkApk] = useState("");
  const [linkServidor, setLinkServidor] = useState("");
  const [linkApi, setLinkApi] = useState("");
  const [selectedAccessRow, setSelectedAccessRow] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const isAdmin = role === "admin";

  useEffect(() => {
    const sync = () => setIsMobileTab(findMobileSheetSelect()?.value === "tbControleMobiles");
    const restore = () => { if (sessionStorage.getItem("restore-mobile-sheet") !== "1") return; const select = findMobileSheetSelect(); if (!select) return; sessionStorage.removeItem("restore-mobile-sheet"); select.value = "tbControleMobiles"; select.dispatchEvent(new Event("change", { bubbles: true })); };
    const onChange = () => sync();
    document.addEventListener("change", onChange, true);
    const interval = window.setInterval(() => { restore(); sync(); }, 400);
    restore(); sync();
    return () => { document.removeEventListener("change", onChange, true); window.clearInterval(interval); };
  }, []);

  const fetchConfig = async () => {
    setLoading(true); setError("");
    try {
      const response = await apiFetch(`/api/data?sheet=tbConfigMobiles&_=${Date.now()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao carregar versões alvo.");
      setConfig(Array.isArray(result) ? result.filter(Array.isArray) : []);
    } catch (err: any) { setError(err?.message || "Erro ao carregar versões alvo."); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen || isAccessOpen) fetchConfig(); }, [isOpen, isAccessOpen]);

  const headers = config[0] || [];
  const appIdx = useMemo(() => headers.findIndex((header) => normalize(header) === normalize("APP_USO")), [headers]);
  const versaoIdx = useMemo(() => headers.findIndex((header) => normalize(header) === normalize("VERSAO_ALVO")), [headers]);
  const apkIdx = useMemo(() => headers.findIndex((header) => normalize(header) === normalize("LINK_DOWNLOAD_APK")), [headers]);
  const servidorIdx = useMemo(() => headers.findIndex((header) => normalize(header) === normalize("LINK_SERVIDOR")), [headers]);
  const apiIdx = useMemo(() => headers.findIndex((header) => normalize(header) === normalize("LINK_API")), [headers]);
  const rows = config.slice(1);
  const getCell = (row: string[], index: number) => index !== -1 ? String(row[index] || "").trim() : "";

  const resetForm = () => { setEditingRowIndex(null); setAppUso(""); setVersaoAlvo(""); setLinkApk(""); setLinkServidor(""); setLinkApi(""); setError(""); };
  const handleEdit = (row: string[], rowIndex: number) => { setEditingRowIndex(rowIndex); setAppUso(getCell(row, appIdx)); setVersaoAlvo(getCell(row, versaoIdx)); setLinkApk(getCell(row, apkIdx)); setLinkServidor(getCell(row, servidorIdx)); setLinkApi(getCell(row, apiIdx)); setError(""); };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const app = appUso.trim().toUpperCase(); const version = versaoAlvo.trim(); const apk = linkApk.trim(); const servidor = linkServidor.trim(); const api = linkApi.trim();
    if (!app) return setError("Informe o aplicativo.");
    if (normalize(app) === "todos") return setError("TODOS não é um aplicativo. Cadastre somente os Apps reais.");
    if (!version) return setError("Informe a versão alvo.");
    if (apk && !isHttpUrl(apk)) return setError("Informe um link de download válido iniciado por http:// ou https://.");
    if (servidor && !isHttpUrl(servidor)) return setError("Informe um link de servidor válido iniciado por http:// ou https://.");
    if (api && !isHttpUrl(api)) return setError("Informe um link de API válido iniciado por http:// ou https://.");
    if (apkIdx === -1) return setError("A coluna LINK_DOWNLOAD_APK não foi encontrada na tbConfigMobiles.");
    if (appIdx === -1 || versaoIdx === -1) return setError("As colunas APP_USO e VERSAO_ALVO não foram encontradas na tbConfigMobiles.");
    if (rows.some((row, index) => normalize(getCell(row, appIdx)) === normalize(app) && index + 2 !== editingRowIndex)) return setError("Já existe uma versão alvo cadastrada para este aplicativo.");
    setSaving(true); setError("");
    try {
      const baseRow = editingRowIndex !== null ? [...(rows[editingRowIndex - 2] || [])] : Array.from({ length: headers.length }, () => "");
      while (baseRow.length < headers.length) baseRow.push("");
      baseRow[appIdx] = app; baseRow[versaoIdx] = version; baseRow[apkIdx] = apk;
      if (servidorIdx !== -1) baseRow[servidorIdx] = servidor;
      if (apiIdx !== -1) baseRow[apiIdx] = api;
      const response = await apiFetch(editingRowIndex === null ? "/api/create" : "/api/update", { method: editingRowIndex === null ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingRowIndex === null ? { rowData: baseRow, sheet: "tbConfigMobiles" } : { rowData: baseRow, rowIndex: editingRowIndex, sheet: "tbConfigMobiles" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao salvar versão alvo.");
      await fetchConfig(); resetForm();
    } catch (err: any) { setError(err?.message || "Erro ao salvar versão alvo."); }
    finally { setSaving(false); }
  };

  const handleReloadClassification = () => { sessionStorage.setItem("restore-mobile-sheet", "1"); window.location.reload(); };
  const accessOptions = useMemo(() => rows.map((row, index) => ({
    rowIndex: index + 2,
    app: getCell(row, appIdx),
    version: getCell(row, versaoIdx),
    links: [
      { key: "apk" as const, label: "Download APK", link: getCell(row, apkIdx) },
      { key: "server" as const, label: "Servidor", link: getCell(row, servidorIdx) },
      { key: "api" as const, label: "API", link: getCell(row, apiIdx) },
    ].filter((item) => isHttpUrl(item.link)),
  })).filter((item) => item.app && item.links.length > 0), [rows, appIdx, versaoIdx, apkIdx, servidorIdx, apiIdx]);
  const selectedAccess = accessOptions.find((item) => item.rowIndex === selectedAccessRow) || null;
  const buttonStyle: React.CSSProperties = { padding: "10px 14px", borderRadius: "9px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700, fontSize: "12px" };
  const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-primary)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)", outline: "none", fontSize: "13px" };

  const copyLink = async (key: string, link: string) => {
    try { await navigator.clipboard.writeText(link); setCopiedKey(key); window.setTimeout(() => setCopiedKey(null), 1800); }
    catch { setError("Não foi possível copiar o link automaticamente."); }
  };

  if (!isMobileTab) return null;

  return <>
    <div style={{ position: "fixed", right: "24px", bottom: "24px", zIndex: 1050, display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "calc(100vw - 32px)" }}>
      <button type="button" onClick={() => { setError(""); setCopiedKey(null); setSelectedAccessRow(null); setIsAccessOpen(true); }} title="Selecionar aplicativo e acessar APK, servidor e API" style={{ ...buttonStyle, border: "1px solid rgba(16,185,129,.45)", backgroundColor: "#059669", color: "#fff", boxShadow: "0 10px 24px rgba(5,150,105,.24)" }}>🔗 Acessos dos Apps</button>
      {isAdmin && <button type="button" onClick={() => { resetForm(); setIsOpen(true); }} title="Gerenciar versões alvo dos aplicativos" style={{ ...buttonStyle, border: "1px solid rgba(59,130,246,.45)", backgroundColor: "#2563EB", color: "#fff", boxShadow: "0 10px 24px rgba(37,99,235,.24)" }}>⚙ Versões Alvo</button>}
    </div>

    {isAccessOpen && <div style={{ position: "fixed", inset: 0, zIndex: 1500, backgroundColor: "rgba(15,23,42,.68)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAccessOpen(false); }}>
      <div style={{ width: "100%", maxWidth: "620px", maxHeight: "90vh", overflowY: "auto", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,.4)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}><div><h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "19px" }}>Acessos dos Aplicativos</h3><p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>Selecione o aplicativo para acessar o APK, o servidor e, quando cadastrado, a API.</p></div><button type="button" onClick={() => setIsAccessOpen(false)} style={{ ...buttonStyle, width: "34px", height: "34px", padding: 0, fontSize: "18px" }}>×</button></div>
        <div style={{ padding: "20px" }}>
          {error && <div style={{ marginBottom: "14px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "rgba(220,38,38,.12)", border: "1px solid rgba(239,68,68,.35)", color: "#EF4444", fontSize: "12px" }}>{error}</div>}
          {loading ? <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Carregando acessos disponíveis...</div> : accessOptions.length === 0 ? <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.5 }}>Nenhum aplicativo possui link de acesso cadastrado.</div> : <>
            <label style={{ display: "flex", flexDirection: "column", gap: "7px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Aplicativo<select value={selectedAccessRow ?? ""} onChange={(event) => { setSelectedAccessRow(event.target.value ? Number(event.target.value) : null); setCopiedKey(null); setError(""); }} style={inputStyle}><option value="">Selecione o aplicativo</option>{accessOptions.map((item) => <option key={item.rowIndex} value={item.rowIndex}>{item.app} — versão alvo {item.version || "-"}</option>)}</select></label>
            {selectedAccess && <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ textAlign: "center" }}><div style={{ color: "var(--text-primary)", fontSize: "16px", fontWeight: 800 }}>{selectedAccess.app}</div><div style={{ marginTop: "3px", color: "var(--text-muted)", fontSize: "12px" }}>Versão alvo: {selectedAccess.version || "-"}</div></div>
              {selectedAccess.links.map((item) => <div key={item.key} style={{ padding: "16px", borderRadius: "12px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}><div style={{ marginBottom: "12px", color: "var(--text-primary)", fontSize: "13px", fontWeight: 800, textAlign: "center" }}>{item.label}</div><div style={{ display: "flex", justifyContent: "center" }}><div style={{ padding: "10px", backgroundColor: "#fff", borderRadius: "10px", border: "1px solid var(--border-primary)" }}><QRCodeSVG value={item.link} size={190} level="M" includeMargin /></div></div><div style={{ marginTop: "12px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-muted)", fontSize: "11px", wordBreak: "break-all" }}>{item.link}</div><div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}><button type="button" onClick={() => window.open(item.link, "_blank", "noopener,noreferrer")} style={{ ...buttonStyle, backgroundColor: "#2563EB", color: "#fff", border: "none" }}>Abrir link</button><button type="button" onClick={() => copyLink(`${selectedAccess.rowIndex}-${item.key}`, item.link)} style={{ ...buttonStyle, backgroundColor: copiedKey === `${selectedAccess.rowIndex}-${item.key}` ? "#059669" : "var(--bg-primary)", color: copiedKey === `${selectedAccess.rowIndex}-${item.key}` ? "#fff" : "var(--text-primary)" }}>{copiedKey === `${selectedAccess.rowIndex}-${item.key}` ? "✓ Link copiado" : "Copiar link"}</button></div></div>)}
            </div>}
          </>}
        </div>
      </div>
    </div>}

    {isOpen && isAdmin && <div style={{ position: "fixed", inset: 0, zIndex: 1400, backgroundColor: "rgba(15,23,42,.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setIsOpen(false); }}>
      <div style={{ width: "100%", maxWidth: "1000px", maxHeight: "86vh", overflow: "hidden", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "14px", boxShadow: "0 25px 50px -12px rgba(0,0,0,.35)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}><div><h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "19px" }}>Versões Alvo dos Apps</h3><p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>Administração exclusiva. Cadastre os links de acesso de cada aplicativo.</p></div><button type="button" disabled={saving} onClick={() => setIsOpen(false)} style={{ ...buttonStyle, width: "34px", height: "34px", padding: 0, fontSize: "18px" }}>×</button></div>
        <div style={{ padding: "20px", overflowY: "auto", maxHeight: "calc(86vh - 78px)" }}>
          {error && <div style={{ marginBottom: "14px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "rgba(220,38,38,.12)", border: "1px solid rgba(239,68,68,.35)", color: "#EF4444", fontSize: "12px" }}>{error}</div>}
          <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "12px", alignItems: "end", padding: "14px", marginBottom: "18px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)", borderRadius: "10px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>Aplicativo<input value={appUso} onChange={(event) => setAppUso(event.target.value)} placeholder="Ex.: FARMACIA" style={inputStyle} disabled={saving} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>Versão alvo<input value={versaoAlvo} onChange={(event) => setVersaoAlvo(event.target.value)} placeholder="Ex.: 5.3.0" style={inputStyle} disabled={saving} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>Link de download do APK<input value={linkApk} onChange={(event) => setLinkApk(event.target.value)} placeholder="https://.../app.apk" style={inputStyle} disabled={saving} inputMode="url" /></label>
            {servidorIdx !== -1 && <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>Link do servidor<input value={linkServidor} onChange={(event) => setLinkServidor(event.target.value)} placeholder="https://servidor/..." style={inputStyle} disabled={saving} inputMode="url" /></label>}
            {apiIdx !== -1 && <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>Link da API<input value={linkApi} onChange={(event) => setLinkApi(event.target.value)} placeholder="https://api/..." style={inputStyle} disabled={saving} inputMode="url" /></label>}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap", gridColumn: "1 / -1" }}>{editingRowIndex !== null && <button type="button" onClick={resetForm} disabled={saving} style={buttonStyle}>Cancelar</button>}<button type="submit" disabled={saving} style={{ ...buttonStyle, border: "none", backgroundColor: "#3B82F6", color: "#fff", whiteSpace: "nowrap" }}>{saving ? "Salvando..." : editingRowIndex !== null ? "Salvar" : "+ Adicionar"}</button></div>
          </form>
          {(servidorIdx === -1 || apiIdx === -1) && <div style={{ marginBottom: "16px", padding: "12px", borderRadius: "8px", backgroundColor: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.28)", color: "#F59E0B", fontSize: "12px", lineHeight: 1.5 }}>Para habilitar os acessos adicionais, adicione na tbConfigMobiles as colunas <strong>LINK_SERVIDOR</strong> e <strong>LINK_API</strong>. Os campos aparecem automaticamente quando as colunas existirem.</div>}
          <div style={{ border: "1px solid var(--border-primary)", borderRadius: "10px", overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}><thead><tr style={{ backgroundColor: "var(--bg-primary)" }}><th style={{ padding: "11px 14px", textAlign: "left", color: "var(--text-muted)", fontSize: "12px" }}>Aplicativo</th><th style={{ padding: "11px 14px", textAlign: "left", color: "var(--text-muted)", fontSize: "12px" }}>Versão alvo</th><th style={{ padding: "11px 14px", textAlign: "left", color: "var(--text-muted)", fontSize: "12px" }}>APK</th>{servidorIdx !== -1 && <th style={{ padding: "11px 14px", textAlign: "left", color: "var(--text-muted)", fontSize: "12px" }}>Servidor</th>}{apiIdx !== -1 && <th style={{ padding: "11px 14px", textAlign: "left", color: "var(--text-muted)", fontSize: "12px" }}>API</th>}<th style={{ padding: "11px 14px", textAlign: "right", color: "var(--text-muted)", fontSize: "12px" }}>Ações</th></tr></thead><tbody>{loading ? <tr><td colSpan={3 + (servidorIdx !== -1 ? 1 : 0) + (apiIdx !== -1 ? 1 : 0) + 1} style={{ padding: "26px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>Carregando configurações...</td></tr> : rows.length === 0 ? <tr><td colSpan={3 + (servidorIdx !== -1 ? 1 : 0) + (apiIdx !== -1 ? 1 : 0) + 1} style={{ padding: "26px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>Nenhuma versão alvo cadastrada.</td></tr> : rows.map((row, index) => { const sheetRowIndex = index + 2; const app = getCell(row, appIdx); const version = getCell(row, versaoIdx); const apk = getCell(row, apkIdx); const servidor = getCell(row, servidorIdx); const api = getCell(row, apiIdx); return <tr key={`${app}-${sheetRowIndex}`} style={{ borderTop: "1px solid var(--border-primary)" }}><td style={{ padding: "12px 14px", color: "var(--text-primary)", fontSize: "13px", fontWeight: 700 }}>{app || "-"}</td><td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontSize: "13px" }}>{version || "-"}</td><td style={{ padding: "12px 14px", color: apk ? "#10B981" : "var(--text-muted)", fontSize: "12px" }}>{apk ? "✓ Cadastrado" : "Sem link"}</td>{servidorIdx !== -1 && <td style={{ padding: "12px 14px", color: servidor ? "#10B981" : "var(--text-muted)", fontSize: "12px" }}>{servidor ? "✓ Cadastrado" : "Sem link"}</td>}{apiIdx !== -1 && <td style={{ padding: "12px 14px", color: api ? "#10B981" : "var(--text-muted)", fontSize: "12px" }}>{api ? "✓ Cadastrado" : "Sem link"}</td>}<td style={{ padding: "10px 14px", textAlign: "right" }}><button type="button" onClick={() => handleEdit(row, sheetRowIndex)} style={{ ...buttonStyle, padding: "7px 11px" }}>Editar</button></td></tr>; })}</tbody></table></div>
          <div style={{ marginTop: "16px", padding: "12px", borderRadius: "8px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.6 }}>O QR Code disponibiliza o mesmo link cadastrado. Para ASSISTENCIAL e FARMACIA, use APK + Servidor. Para HIGIENIZACAO, cadastre também a API. A API só é exibida quando houver link cadastrado.</div>
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}><button type="button" onClick={handleReloadClassification} style={buttonStyle}>↻ Recarregar classificação</button><button type="button" onClick={() => setIsOpen(false)} style={buttonStyle}>Fechar</button></div>
        </div>
      </div>
    </div>}
  </>;
}
