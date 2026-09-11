import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../auth/api";
import { PERMISSION_CATALOG, type PermissionKey, type PermissionMap, type UserRole } from "../shared/permissions";
import { useAuth } from "../contexts/AuthContext";

interface Props { isOpen: boolean; onClose: () => void; }
type Matrix = Record<UserRole, PermissionMap>;

export default function PermissionManagement({ isOpen, onClose }: Props) {
  const { refreshPermissions } = useAuth();
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const groups = useMemo(() => Array.from(new Set(PERMISSION_CATALOG.map((item) => item.group))), []);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await apiFetch("/api/permissions", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar as permissões.");
      setMatrix(result.matrix);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao carregar permissões."); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen) void load(); }, [isOpen]);
  if (!isOpen) return null;

  const toggle = async (role: "analyst" | "viewer", permission: PermissionKey) => {
    if (!matrix) return;
    const enabled = !matrix[role][permission];
    setSaving(`${role}:${permission}`); setError("");
    try {
      const response = await apiFetch("/api/permissions", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ role, permission, enabled }] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível alterar a permissão.");
      setMatrix(result.matrix);
      await refreshPermissions();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao alterar permissão."); }
    finally { setSaving(null); }
  };

  return <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(2,6,23,.78)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
    <section style={{ width: "min(1050px, 100%)", maxHeight: "92vh", overflow: "auto", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 14, boxShadow: "0 25px 70px rgba(0,0,0,.35)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--bg-secondary)", padding: 20, borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div><h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: 20 }}>Permissões dos perfis</h2><p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 12 }}>Administrador tem acesso integral. Configure Analista e Consulta.</p></div>
        <button type="button" onClick={onClose} style={{ padding: "8px 13px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer" }}>Fechar</button>
      </header>
      <div style={{ padding: 20 }}>
        {error && <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, color: "#DC2626", background: "rgba(220,38,38,.1)" }}>{error}</div>}
        {loading || !matrix ? <div style={{ color: "var(--text-muted)", padding: 24, textAlign: "center" }}>Carregando permissões...</div> : groups.map((group) => <div key={group} style={{ marginBottom: 22 }}>
          <h3 style={{ margin: "0 0 8px", color: "var(--text-primary)", fontSize: 14 }}>{group}</h3>
          <div style={{ overflowX: "auto", border: "1px solid var(--border-primary)", borderRadius: 10 }}><table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "var(--bg-primary)" }}><th style={{ padding: 11, textAlign: "left", color: "var(--text-muted)" }}>Permissão</th><th style={{ padding: 11, width: 135, color: "var(--text-muted)" }}>Administrador</th><th style={{ padding: 11, width: 135, color: "var(--text-muted)" }}>Analista</th><th style={{ padding: 11, width: 135, color: "var(--text-muted)" }}>Consulta</th></tr></thead>
            <tbody>{PERMISSION_CATALOG.filter((item) => item.group === group).map((item) => <tr key={item.key} style={{ borderTop: "1px solid var(--border-primary)" }}>
              <td style={{ padding: 11, color: "var(--text-primary)", fontSize: 13 }}>{item.label}<div style={{ color: "var(--text-muted)", fontSize: 10 }}>{item.key}</div></td>
              <td style={{ textAlign: "center", color: "#10B981", fontWeight: 700 }}>🔒 Ativo</td>
              {(["analyst", "viewer"] as const).map((role) => { const id = `${role}:${item.key}`; return <td key={role} style={{ textAlign: "center" }}><input aria-label={`${item.label} - ${role === "analyst" ? "Analista" : "Consulta"}`} type="checkbox" checked={matrix[role][item.key]} disabled={saving !== null} onChange={() => void toggle(role, item.key)} style={{ width: 18, height: 18, cursor: saving ? "wait" : "pointer" }} />{saving === id && <span style={{ marginLeft: 6, color: "var(--text-muted)", fontSize: 10 }}>Salvando</span>}</td>; })}
            </tr>)}</tbody>
          </table></div>
        </div>)}
      </div>
    </section>
  </div>;
}
