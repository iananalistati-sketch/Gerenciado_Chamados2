import React, { useMemo } from "react";

interface DetalhesAppsMobileModalProps {
  isOpen: boolean;
  coletor: string;
  appRows: string[][];
  mobileApps: string[][];
  mobileConfig: string[][];
  onClose: () => void;
}

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export default function DetalhesAppsMobileModal({
  isOpen,
  coletor,
  appRows,
  mobileApps,
  mobileConfig,
  onClose,
}: DetalhesAppsMobileModalProps) {
  const appHeaders =
    mobileApps[0] || [];

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

  const appIdx =
    getIndex("APP_USO");

  const versaoIdx =
    getIndex("VERSAO");

  const dataIdx =
    getIndex("DATA_ATUALIZACAO");

  const responsavelIdx =
    getIndex(
      "RESPONSAVEL_ATUALIZACAO"
    );

  const contadorIdx =
    getIndex(
      "CONTADOR_ATUALIZACAO"
    );

  const obsIdx =
    getIndex("OBS");

  const targetVersions =
    useMemo(() => {
      const map: Record<
        string,
        string
      > = {};

      if (
        !mobileConfig ||
        mobileConfig.length <= 1
      ) {
        return map;
      }

      const headers =
        mobileConfig[0] || [];

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

          const version =
            String(
              row[
                configVersionIdx
              ] || ""
            ).trim();

          if (app && version) {
            map[
              normalize(app)
            ] = version;
          }
        });

      return map;
    }, [mobileConfig]);

  const getStatus = (
    app: string,
    currentVersion: string
  ) => {
    const current =
      String(
        currentVersion || ""
      ).trim();

    const target =
      targetVersions[
        normalize(app)
      ];

    if (!current || !target) {
      return "SEM INFORMAÇÃO";
    }

    if (current === target) {
      return "ATUALIZADO";
    }

    return "PENDENTE";
  };

  const getStatusStyle = (
    status: string
  ): React.CSSProperties => {
    const value =
      normalize(status);

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

  if (!isOpen) {
    return null;
  }

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
          maxWidth: "920px",
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

        <div
          style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: "65vh",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              minWidth: "820px",
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
              {appRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "30px",
                      textAlign:
                        "center",
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    Nenhum aplicativo
                    cadastrado para este
                    equipamento.
                  </td>
                </tr>
              ) : (
                appRows.map(
                  (row, index) => {
                    const app =
                      appIdx !== -1
                        ? String(
                            row[
                              appIdx
                            ] || ""
                          ).trim()
                        : "";

                    const version =
                      versaoIdx !== -1
                        ? String(
                            row[
                              versaoIdx
                            ] || ""
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
                        <td
                          style={{
                            padding:
                              "13px 14px",
                            color:
                              "var(--text-primary)",
                            fontSize:
                              "13px",
                            fontWeight:
                              700,
                          }}
                        >
                          {app || "-"}
                        </td>

                        <td
                          style={{
                            padding:
                              "13px 14px",
                            color:
                              "var(--text-primary)",
                            fontSize:
                              "13px",
                          }}
                        >
                          {version ||
                            "-"}
                        </td>

                        <td
                          style={{
                            padding:
                              "13px 14px",
                            color:
                              "var(--text-primary)",
                            fontSize:
                              "13px",
                          }}
                        >
                          {target ||
                            "-"}
                        </td>

                        <td
                          style={{
                            padding:
                              "13px 14px",
                          }}
                        >
                          <span
                            style={{
                              display:
                                "inline-flex",
                              padding:
                                "5px 9px",
                              borderRadius:
                                "999px",
                              fontSize:
                                "11px",
                              fontWeight:
                                700,
                              whiteSpace:
                                "nowrap",
                              ...getStatusStyle(
                                status
                              ),
                            }}
                          >
                            {status}
                          </span>
                        </td>

                        <td
                          style={{
                            padding:
                              "13px 14px",
                            color:
                              "var(--text-secondary)",
                            fontSize:
                              "12px",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {dataIdx !== -1
                            ? row[
                                dataIdx
                              ] || "-"
                            : "-"}
                        </td>

                        <td
                          style={{
                            padding:
                              "13px 14px",
                            color:
                              "var(--text-secondary)",
                            fontSize:
                              "12px",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {responsavelIdx !==
                          -1
                            ? row[
                                responsavelIdx
                              ] || "-"
                            : "-"}
                        </td>

                        <td
                          style={{
                            padding:
                              "13px 14px",
                            color:
                              "var(--text-secondary)",
                            fontSize:
                              "12px",
                            textAlign:
                              "center",
                          }}
                        >
                          {contadorIdx !== -1
                            ? row[
                                contadorIdx
                              ] || "0"
                            : "0"}
                        </td>

                        <td
                          style={{
                            padding:
                              "13px 14px",
                            color:
                              "var(--text-secondary)",
                            fontSize:
                              "12px",
                          }}
                        >
                          {obsIdx !== -1
                            ? row[
                                obsIdx
                              ] || "-"
                            : "-"}
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: "14px 20px",
            borderTop:
              "1px solid var(--border-primary)",
            display: "flex",
            justifyContent:
              "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px",
              backgroundColor:
                "var(--bg-primary)",
              color:
                "var(--text-primary)",
              border:
                "1px solid var(--border-primary)",
              borderRadius: "8px",
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
  );
}