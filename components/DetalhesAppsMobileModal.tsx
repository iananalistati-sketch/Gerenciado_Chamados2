import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

interface DetalhesAppsMobileModalProps {
  isOpen: boolean;
  coletor: string;
  appRows: string[][];
  mobileApps: string[][];
  mobileConfig: string[][];
  currentUserName: string;
  canEdit: boolean;

  onSave: (
    rowData: string[],
    rowIndex: number
  ) => Promise<void>;

  onClose: () => void;
}

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getToday = () => {
  const now = new Date();
  const localDate = new Date(
    now.getTime() -
      now.getTimezoneOffset() * 60000
  );

  return localDate
    .toISOString()
    .split("T")[0];
};

export default function DetalhesAppsMobileModal({
  isOpen,
  coletor,
  appRows,
  mobileApps,
  mobileConfig,
  currentUserName,
  canEdit,
  onSave,
  onClose,
}: DetalhesAppsMobileModalProps) {
  const [freshMobileApps, setFreshMobileApps] =
    useState<string[][]>([]);
  const [loadingApps, setLoadingApps] =
    useState(false);
  const [loadError, setLoadError] =
    useState("");

  const [editingAppRow, setEditingAppRow] =
    useState<string[] | null>(null);
  const [editingRowIndex, setEditingRowIndex] =
    useState<number | null>(null);
  const [editedVersion, setEditedVersion] =
    useState("");
  const [editedObs, setEditedObs] =
    useState("");
  const [saving, setSaving] =
    useState(false);
  const [saveError, setSaveError] =
    useState("");

  const loadFreshApps = async () => {
    if (!isOpen || !coletor) {
      return;
    }

    setLoadingApps(true);
    setLoadError("");

    try {
      const res = await fetch(
        `/api/data?sheet=tbMobileApps&_=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      const values = await res.json();

      if (!res.ok) {
        throw new Error(
          values?.error ||
            "Erro ao carregar aplicativos do mobile."
        );
      }

      const rows = Array.isArray(values)
        ? values.filter(
            (row) => Array.isArray(row)
          )
        : [];

      rows.forEach((row, index) => {
        (row as any)._originalIndex =
          index + 1;
      });

      setFreshMobileApps(rows);
    } catch (error: any) {
      console.error(
        "Erro ao recarregar tbMobileApps:",
        error
      );

      setLoadError(
        error?.message ||
          "Erro ao carregar aplicativos do mobile."
      );
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setFreshMobileApps([]);
      setLoadError("");
      setEditingAppRow(null);
      setEditingRowIndex(null);
      setEditedVersion("");
      setEditedObs("");
      setSaveError("");
      return;
    }

    void loadFreshApps();
  }, [isOpen, coletor]);

  const sourceMobileApps =
    freshMobileApps.length > 0
      ? freshMobileApps
      : mobileApps;

  const appHeaders =
    sourceMobileApps[0] ||
    mobileApps[0] ||
    [];

  const getIndex = (
    ...possibleNames: string[]
  ) =>
    appHeaders.findIndex((header) =>
      possibleNames.some(
        (name) =>
          normalize(header) ===
          normalize(name)
      )
    );

  const coletorIdx = getIndex("COLETOR");
  const appIdx = getIndex("APP_USO");
  const versaoIdx = getIndex("VERSAO");
  const dataIdx = getIndex("DATA_ATUALIZACAO");
  const responsavelIdx = getIndex(
    "RESPONSAVEL_ATUALIZACAO"
  );
  const contadorIdx = getIndex(
    "CONTADOR_ATUALIZACAO"
  );
  const obsIdx = getIndex("OBS");

  const displayRows = useMemo(() => {
    if (
      freshMobileApps.length > 1 &&
      coletorIdx !== -1
    ) {
      return freshMobileApps
        .slice(1)
        .filter(
          (row) =>
            normalize(
              row[coletorIdx] || ""
            ) === normalize(coletor)
        );
    }

    return appRows;
  }, [
    freshMobileApps,
    appRows,
    coletor,
    coletorIdx,
  ]);

  const targetVersions = useMemo(() => {
    const map: Record<string, string> = {};

    if (
      !mobileConfig ||
      mobileConfig.length <= 1
    ) {
      return map;
    }

    const headers = mobileConfig[0] || [];

    const configAppIdx =
      headers.findIndex(
        (header) =>
          normalize(header) ===
          normalize("APP_USO")
      );

    const configVersionIdx =
      headers.findIndex(
        (header) =>
          normalize(header) ===
          normalize("VERSAO_ALVO")
      );

    if (
      configAppIdx === -1 ||
      configVersionIdx === -1
    ) {
      return map;
    }

    mobileConfig
      .slice(1)
      .forEach((row) => {
        const app = String(
          row[configAppIdx] || ""
        ).trim();

        const version = String(
          row[configVersionIdx] || ""
        ).trim();

        if (app && version) {
          map[normalize(app)] = version;
        }
      });

    return map;
  }, [mobileConfig]);

  const getStatus = (
    app: string,
    currentVersion: string
  ) => {
    const current = String(
      currentVersion || ""
    ).trim();

    const target =
      targetVersions[normalize(app)];

    if (!current || !target) {
      return "SEM INFORMAÇÃO";
    }

    return current === target
      ? "ATUALIZADO"
      : "PENDENTE";
  };

  const getStatusStyle = (
    status: string
  ): React.CSSProperties => {
    const value = normalize(status);

    if (value === "atualizado") {
      return {
        backgroundColor:
          "rgba(5, 150, 105, 0.14)",
        color: "#10B981",
        border:
          "1px solid rgba(16, 185, 129, 0.35)",
      };
    }

    if (value === "pendente") {
      return {
        backgroundColor:
          "rgba(245, 158, 11, 0.14)",
        color: "#F59E0B",
        border:
          "1px solid rgba(245, 158, 11, 0.35)",
      };
    }

    return {
      backgroundColor:
        "var(--bg-primary)",
      color: "var(--text-muted)",
      border:
        "1px solid var(--border-primary)",
    };
  };

  const getOriginalIndex = (
    row: string[]
  ): number | null => {
    const value =
      (row as any)._originalIndex;

    return typeof value === "number"
      ? value
      : null;
  };

  const handleEditApp = (
    row: string[]
  ) => {
    if (!canEdit) {
      return;
    }

    const rowIndex =
      getOriginalIndex(row);

    if (rowIndex === null) {
      setSaveError(
        "Não foi possível identificar a linha do aplicativo."
      );
      return;
    }

    setEditingAppRow(row);
    setEditingRowIndex(rowIndex);

    setEditedVersion(
      versaoIdx !== -1
        ? String(
            row[versaoIdx] || ""
          ).trim()
        : ""
    );

    setEditedObs(
      obsIdx !== -1
        ? String(
            row[obsIdx] || ""
          ).trim()
        : ""
    );

    setSaveError("");
  };

  const handleCancelEdit = () => {
    setEditingAppRow(null);
    setEditingRowIndex(null);
    setEditedVersion("");
    setEditedObs("");
    setSaveError("");
  };

  const handleSaveApp = async () => {
    if (
      !editingAppRow ||
      editingRowIndex === null
    ) {
      return;
    }

    const newVersion =
      editedVersion.trim();

    if (!newVersion) {
      setSaveError(
        "Informe a versão do aplicativo."
      );
      return;
    }

    const updatedRow = [
      ...editingAppRow,
    ];

    const oldVersion =
      versaoIdx !== -1
        ? String(
            editingAppRow[
              versaoIdx
            ] || ""
          ).trim()
        : "";

    const versionChanged =
      newVersion !== oldVersion;

    if (versaoIdx !== -1) {
      updatedRow[versaoIdx] =
        newVersion;
    }

    if (obsIdx !== -1) {
      updatedRow[obsIdx] =
        editedObs.trim();
    }

    if (versionChanged) {
      if (dataIdx !== -1) {
        updatedRow[dataIdx] = getToday();
      }

      if (responsavelIdx !== -1) {
        updatedRow[
          responsavelIdx
        ] = currentUserName;
      }

      if (contadorIdx !== -1) {
        const currentCounter =
          Number(
            String(
              editingAppRow[
                contadorIdx
              ] || "0"
            )
              .trim()
              .replace(",", ".")
          ) || 0;

        updatedRow[
          contadorIdx
        ] = String(
          currentCounter + 1
        );
      }
    }

    try {
      setSaving(true);
      setSaveError("");

      await onSave(
        updatedRow,
        editingRowIndex
      );

      handleCancelEdit();
      await loadFreshApps();
    } catch (error: any) {
      setSaveError(
        error?.message ||
          "Erro ao atualizar aplicativo."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)",
    border:
      "1px solid var(--border-primary)",
    borderRadius: "8px",
    fontSize: "13px",
    outline: "none",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
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
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "980px",
          maxHeight: "85vh",
          overflow: "hidden",
          backgroundColor:
            "var(--bg-secondary)",
          border:
            "1px solid var(--border-primary)",
          borderRadius: "14px",
          boxShadow:
            "0 20px 50px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom:
              "1px solid var(--border-primary)",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                color:
                  "var(--text-primary)",
                fontSize: "18px",
              }}
            >
              Aplicativos do mobile
            </h3>

            <div
              style={{
                marginTop: "5px",
                color:
                  "var(--text-muted)",
                fontSize: "12px",
              }}
            >
              Coletor:{" "}
              <strong
                style={{
                  color:
                    "var(--text-primary)",
                }}
              >
                {coletor}
              </strong>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={() =>
                void loadFreshApps()
              }
              disabled={loadingApps}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border:
                  "1px solid var(--border-primary)",
                backgroundColor:
                  "var(--bg-primary)",
                color:
                  "var(--text-primary)",
                cursor: loadingApps
                  ? "not-allowed"
                  : "pointer",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {loadingApps
                ? "Atualizando..."
                : "↻ Atualizar"}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                border:
                  "1px solid var(--border-primary)",
                backgroundColor:
                  "var(--bg-primary)",
                color:
                  "var(--text-primary)",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {(loadError || saveError) && (
          <div
            style={{
              margin: "14px 20px 0",
              padding: "10px 12px",
              borderRadius: "8px",
              backgroundColor:
                "rgba(220, 38, 38, 0.12)",
              color: "#EF4444",
              border:
                "1px solid rgba(239, 68, 68, 0.35)",
              fontSize: "12px",
            }}
          >
            {saveError || loadError}
          </div>
        )}

        <div
          style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: "58vh",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              minWidth: "900px",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor:
                    "var(--bg-primary)",
                }}
              >
                {[
                  "Aplicativo",
                  "Versão atual",
                  "Versão alvo",
                  "Status",
                  "Última atualização",
                  "Responsável",
                  "Contador",
                  "Observação",
                  "Ações",
                ].map((title) => (
                  <th
                    key={title}
                    style={{
                      padding:
                        "12px 14px",
                      textAlign: "left",
                      color:
                        "var(--text-muted)",
                      fontSize: "12px",
                      fontWeight: 700,
                      whiteSpace:
                        "nowrap",
                      borderBottom:
                        "1px solid var(--border-primary)",
                    }}
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loadingApps &&
              displayRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: "30px",
                      textAlign: "center",
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    Carregando aplicativos...
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: "30px",
                      textAlign: "center",
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    Nenhum aplicativo cadastrado
                    para este equipamento.
                  </td>
                </tr>
              ) : (
                displayRows.map(
                  (row, index) => {
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

                    const target =
                      targetVersions[
                        normalize(app)
                      ] || "";

                    const status =
                      getStatus(
                        app,
                        version
                      );

                    return (
                      <tr
                        key={`${app}-${index}`}
                        style={{
                          borderBottom:
                            "1px solid var(--border-primary)",
                        }}
                      >
                        <td style={{ padding: "13px 14px", color: "var(--text-primary)", fontSize: "13px", fontWeight: 700 }}>
                          {app || "-"}
                        </td>
                        <td style={{ padding: "13px 14px", color: "var(--text-primary)", fontSize: "13px" }}>
                          {version || "-"}
                        </td>
                        <td style={{ padding: "13px 14px", color: "var(--text-primary)", fontSize: "13px" }}>
                          {target || "-"}
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "5px 9px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              ...getStatusStyle(status),
                            }}
                          >
                            {status}
                          </span>
                        </td>
                        <td style={{ padding: "13px 14px", color: "var(--text-secondary)", fontSize: "12px", whiteSpace: "nowrap" }}>
                          {dataIdx !== -1
                            ? row[dataIdx] || "-"
                            : "-"}
                        </td>
                        <td style={{ padding: "13px 14px", color: "var(--text-secondary)", fontSize: "12px", whiteSpace: "nowrap" }}>
                          {responsavelIdx !== -1
                            ? row[responsavelIdx] || "-"
                            : "-"}
                        </td>
                        <td style={{ padding: "13px 14px", color: "var(--text-secondary)", fontSize: "12px", textAlign: "center" }}>
                          {contadorIdx !== -1
                            ? row[contadorIdx] || "0"
                            : "0"}
                        </td>
                        <td style={{ padding: "13px 14px", color: "var(--text-secondary)", fontSize: "12px", minWidth: "160px" }}>
                          {obsIdx !== -1
                            ? row[obsIdx] || "-"
                            : "-"}
                        </td>
                        <td style={{ padding: "13px 14px", whiteSpace: "nowrap" }}>
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleEditApp(row)
                              }
                              style={{
                                padding: "7px 11px",
                                backgroundColor:
                                  "var(--bg-primary)",
                                color:
                                  "var(--text-primary)",
                                border:
                                  "1px solid var(--border-primary)",
                                borderRadius: "7px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: 600,
                              }}
                            >
                              Editar
                            </button>
                          ) : (
                            <span
                              style={{
                                color:
                                  "var(--text-muted)",
                                fontSize: "11px",
                              }}
                            >
                              Somente leitura
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        {editingAppRow && (
          <div
            style={{
              padding: "18px 20px",
              borderTop:
                "1px solid var(--border-primary)",
              display: "grid",
              gridTemplateColumns:
                "minmax(180px, 1fr) minmax(260px, 2fr)",
              gap: "14px",
            }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                color:
                  "var(--text-secondary)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Versão
              <input
                value={editedVersion}
                onChange={(event) =>
                  setEditedVersion(
                    event.target.value
                  )
                }
                style={inputStyle}
              />
            </label>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                color:
                  "var(--text-secondary)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Observação
              <input
                value={editedObs}
                onChange={(event) =>
                  setEditedObs(
                    event.target.value
                  )
                }
                style={inputStyle}
              />
            </label>

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                style={{
                  padding: "9px 14px",
                  backgroundColor:
                    "var(--bg-primary)",
                  color:
                    "var(--text-primary)",
                  border:
                    "1px solid var(--border-primary)",
                  borderRadius: "8px",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSaveApp}
                disabled={saving}
                style={{
                  padding: "9px 15px",
                  backgroundColor: "#3B82F6",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  fontWeight: 700,
                }}
              >
                {saving
                  ? "Salvando..."
                  : "Salvar"}
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            padding: "14px 20px",
            borderTop:
              "1px solid var(--border-primary)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 15px",
              backgroundColor:
                "var(--bg-primary)",
              color:
                "var(--text-primary)",
              border:
                "1px solid var(--border-primary)",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
