import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const findMobileSheetSelect = () =>
  Array.from(document.querySelectorAll("select")).find(
    (select) =>
      Array.from(select.options).some(
        (option) =>
          option.value === "tbControleMobiles"
      )
  ) as HTMLSelectElement | undefined;

export default function MobileTargetVersionsManager() {
  const { role } = useAuth();

  const [isMobileTab, setIsMobileTab] =
    useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<string[][]>([]);

  const [editingRowIndex, setEditingRowIndex] =
    useState<number | null>(null);
  const [appUso, setAppUso] = useState("");
  const [versaoAlvo, setVersaoAlvo] = useState("");

  const isAdmin = role === "admin";

  useEffect(() => {
    const syncCurrentSheet = () => {
      const select = findMobileSheetSelect();

      setIsMobileTab(
        select?.value === "tbControleMobiles"
      );
    };

    const restoreMobileSheet = () => {
      const shouldRestore =
        sessionStorage.getItem(
          "restore-mobile-sheet"
        ) === "1";

      if (!shouldRestore) {
        return;
      }

      const select = findMobileSheetSelect();

      if (!select) {
        return;
      }

      sessionStorage.removeItem(
        "restore-mobile-sheet"
      );

      select.value = "tbControleMobiles";
      select.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    };

    const handleChange = () => {
      syncCurrentSheet();
    };

    document.addEventListener(
      "change",
      handleChange,
      true
    );

    const interval = window.setInterval(() => {
      restoreMobileSheet();
      syncCurrentSheet();
    }, 400);

    restoreMobileSheet();
    syncCurrentSheet();

    return () => {
      document.removeEventListener(
        "change",
        handleChange,
        true
      );
      window.clearInterval(interval);
    };
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/data?sheet=tbConfigMobiles&_=${Date.now()}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Erro ao carregar versões alvo."
        );
      }

      setConfig(
        Array.isArray(result)
          ? result.filter(Array.isArray)
          : []
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Erro ao carregar versões alvo."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const headers = config[0] || [];

  const appIdx = useMemo(
    () =>
      headers.findIndex(
        (header) =>
          normalize(header) ===
          normalize("APP_USO")
      ),
    [headers]
  );

  const versaoIdx = useMemo(
    () =>
      headers.findIndex(
        (header) =>
          normalize(header) ===
          normalize("VERSAO_ALVO")
      ),
    [headers]
  );

  const rows = config.slice(1);

  const resetForm = () => {
    setEditingRowIndex(null);
    setAppUso("");
    setVersaoAlvo("");
    setError("");
  };

  const handleEdit = (
    row: string[],
    rowIndex: number
  ) => {
    setEditingRowIndex(rowIndex);
    setAppUso(
      appIdx !== -1
        ? String(row[appIdx] || "").trim()
        : ""
    );
    setVersaoAlvo(
      versaoIdx !== -1
        ? String(row[versaoIdx] || "").trim()
        : ""
    );
    setError("");
  };

  const handleSave = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const app = appUso.trim().toUpperCase();
    const version = versaoAlvo.trim();

    if (!app) {
      setError("Informe o aplicativo.");
      return;
    }

    if (normalize(app) === "todos") {
      setError(
        "TODOS não é um aplicativo. Cadastre somente os Apps reais."
      );
      return;
    }

    if (!version) {
      setError("Informe a versão alvo.");
      return;
    }

    const duplicate = rows.some(
      (row, index) => {
        const sheetRowIndex = index + 2;
        const rowApp =
          appIdx !== -1
            ? String(row[appIdx] || "").trim()
            : "";

        return (
          normalize(rowApp) === normalize(app) &&
          sheetRowIndex !== editingRowIndex
        );
      }
    );

    if (duplicate) {
      setError(
        "Já existe uma versão alvo cadastrada para este aplicativo."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const rowData = [app, version];

      const response = await fetch(
        editingRowIndex === null
          ? "/api/create"
          : "/api/update",
        {
          method:
            editingRowIndex === null
              ? "POST"
              : "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            editingRowIndex === null
              ? {
                  rowData,
                  sheet: "tbConfigMobiles",
                }
              : {
                  rowData,
                  rowIndex: editingRowIndex,
                  sheet: "tbConfigMobiles",
                }
          ),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Erro ao salvar versão alvo."
        );
      }

      await fetchConfig();
      resetForm();
    } catch (err: any) {
      setError(
        err?.message ||
          "Erro ao salvar versão alvo."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReloadClassification = () => {
    sessionStorage.setItem(
      "restore-mobile-sheet",
      "1"
    );
    window.location.reload();
  };

  if (!isAdmin || !isMobileTab) {
    return null;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-primary)",
    backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)",
    outline: "none",
    fontSize: "13px",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setIsOpen(true);
        }}
        title="Gerenciar versões alvo dos aplicativos"
        style={{
          position: "fixed",
          right: "24px",
          bottom: "24px",
          zIndex: 1050,
          padding: "11px 16px",
          borderRadius: "10px",
          border: "1px solid rgba(59, 130, 246, 0.45)",
          backgroundColor: "#2563EB",
          color: "#FFFFFF",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 700,
          boxShadow:
            "0 10px 24px rgba(37, 99, 235, 0.28)",
        }}
      >
        ⚙ Versões Alvo
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1400,
            backgroundColor:
              "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setIsOpen(false);
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "760px",
              maxHeight: "86vh",
              overflow: "hidden",
              backgroundColor:
                "var(--bg-secondary)",
              border:
                "1px solid var(--border-primary)",
              borderRadius: "14px",
              boxShadow:
                "0 25px 50px -12px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom:
                  "1px solid var(--border-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "var(--text-primary)",
                    fontSize: "19px",
                  }}
                >
                  Versões Alvo dos Apps
                </h3>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                  }}
                >
                  Administração exclusiva. A classificação dos mobiles compara a versão atual com estes valores.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setIsOpen(false)}
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  border:
                    "1px solid var(--border-primary)",
                  backgroundColor:
                    "var(--bg-primary)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "20px",
                overflowY: "auto",
                maxHeight: "calc(86vh - 78px)",
              }}
            >
              {error && (
                <div
                  style={{
                    marginBottom: "14px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor:
                      "rgba(220, 38, 38, 0.12)",
                    border:
                      "1px solid rgba(239, 68, 68, 0.35)",
                    color: "#EF4444",
                    fontSize: "12px",
                  }}
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSave}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1fr) minmax(0, 1fr) auto",
                  gap: "12px",
                  alignItems: "end",
                  padding: "14px",
                  marginBottom: "18px",
                  backgroundColor:
                    "var(--bg-primary)",
                  border:
                    "1px solid var(--border-primary)",
                  borderRadius: "10px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Aplicativo
                  <input
                    value={appUso}
                    onChange={(event) =>
                      setAppUso(event.target.value)
                    }
                    placeholder="Ex.: FARMACIA"
                    style={inputStyle}
                    disabled={saving}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Versão alvo
                  <input
                    value={versaoAlvo}
                    onChange={(event) =>
                      setVersaoAlvo(event.target.value)
                    }
                    placeholder="Ex.: 5.3.0"
                    style={inputStyle}
                    disabled={saving}
                  />
                </label>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                  }}
                >
                  {editingRowIndex !== null && (
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={saving}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border:
                          "1px solid var(--border-primary)",
                        backgroundColor:
                          "var(--bg-secondary)",
                        color:
                          "var(--text-primary)",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Cancelar
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#3B82F6",
                      color: "#FFFFFF",
                      cursor: saving
                        ? "not-allowed"
                        : "pointer",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {saving
                      ? "Salvando..."
                      : editingRowIndex !== null
                      ? "Salvar"
                      : "+ Adicionar"}
                  </button>
                </div>
              </form>

              <div
                style={{
                  border:
                    "1px solid var(--border-primary)",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor:
                          "var(--bg-primary)",
                      }}
                    >
                      <th
                        style={{
                          padding: "11px 14px",
                          textAlign: "left",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        Aplicativo
                      </th>
                      <th
                        style={{
                          padding: "11px 14px",
                          textAlign: "left",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        Versão alvo
                      </th>
                      <th
                        style={{
                          padding: "11px 14px",
                          textAlign: "right",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        Ações
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            padding: "26px",
                            textAlign: "center",
                            color: "var(--text-muted)",
                            fontSize: "13px",
                          }}
                        >
                          Carregando configurações...
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            padding: "26px",
                            textAlign: "center",
                            color: "var(--text-muted)",
                            fontSize: "13px",
                          }}
                        >
                          Nenhuma versão alvo cadastrada.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, index) => {
                        const sheetRowIndex =
                          index + 2;
                        const app =
                          appIdx !== -1
                            ? String(
                                row[appIdx] || ""
                              ).trim()
                            : "";
                        const version =
                          versaoIdx !== -1
                            ? String(
                                row[versaoIdx] || ""
                              ).trim()
                            : "";

                        return (
                          <tr
                            key={`${app}-${sheetRowIndex}`}
                            style={{
                              borderTop:
                                "1px solid var(--border-primary)",
                            }}
                          >
                            <td
                              style={{
                                padding: "12px 14px",
                                color:
                                  "var(--text-primary)",
                                fontSize: "13px",
                                fontWeight: 700,
                              }}
                            >
                              {app || "-"}
                            </td>
                            <td
                              style={{
                                padding: "12px 14px",
                                color:
                                  "var(--text-secondary)",
                                fontSize: "13px",
                              }}
                            >
                              {version || "-"}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                textAlign: "right",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleEdit(
                                    row,
                                    sheetRowIndex
                                  )
                                }
                                style={{
                                  padding: "7px 11px",
                                  borderRadius: "7px",
                                  border:
                                    "1px solid var(--border-primary)",
                                  backgroundColor:
                                    "var(--bg-primary)",
                                  color:
                                    "var(--text-primary)",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                Editar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor:
                    "var(--bg-primary)",
                  border:
                    "1px solid var(--border-primary)",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  lineHeight: 1.6,
                }}
              >
                Alterar uma versão alvo não modifica a versão instalada nos equipamentos. Apenas muda a referência usada para classificar cada App como ATUALIZADO ou PENDENTE.
              </div>

              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={handleReloadClassification}
                  style={{
                    padding: "9px 13px",
                    borderRadius: "8px",
                    border:
                      "1px solid var(--border-primary)",
                    backgroundColor:
                      "var(--bg-primary)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  ↻ Recarregar classificação
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border:
                      "1px solid var(--border-primary)",
                    backgroundColor:
                      "var(--bg-primary)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
