import React, { useEffect, useMemo, useState } from "react";

interface ControleMobilesProps {
  data: string[][];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const normalize = (value: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeValue = (value: string) =>
  normalize(String(value || ""));

export default function ControleMobiles({
  data,
  loading,
  error,
  onRefresh,
}: ControleMobilesProps) {
  const [search, setSearch] = useState("");
  const [setorFilter, setSetorFilter] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusAtualizacaoFilter, setStatusAtualizacaoFilter] =
    useState("");
  const [versaoFilter, setVersaoFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 20;

  const headers = data[0] || [];
  const rows = data.slice(1);

  const getColumnIndex = (...possibleNames: string[]) =>
    headers.findIndex((header) =>
      possibleNames.some(
        (name) => normalize(header) === normalize(name)
      )
    );

  const setorIdx = getColumnIndex("Setor");
  const coletorIdx = getColumnIndex("Coletor");
  const snIdx = getColumnIndex("SN");
  const finalIdx = getColumnIndex("FINAL");
  const macIdx = getColumnIndex("MAC");
  const ipIdx = getColumnIndex("IP");
  const dataAtualizacaoIdx = getColumnIndex(
    "Data atualização",
    "Data atualizacao"
  );
  const appIdx = getColumnIndex(
    "App de uso",
    "Aplicativo",
    "App"
  );
  const setorLocalizadoIdx = getColumnIndex(
    "Setor localizado"
  );
  const versaoIdx = getColumnIndex("Versão", "Versao");
  const statusIdx = getColumnIndex("Status");
  const statusAtualizacaoIdx = getColumnIndex(
    "Status atualização",
    "Status atualizacao"
  );

  const uniqueValues = (columnIndex: number) => {
    if (columnIndex === -1) {
      return [];
    }

    return Array.from(
      new Set(
        rows
          .map((row) => String(row[columnIndex] || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, "pt-BR", {
        sensitivity: "base",
        numeric: true,
      })
    );
  };

  const setores = useMemo(
    () => uniqueValues(setorIdx),
    [data, setorIdx]
  );

  const apps = useMemo(
    () => uniqueValues(appIdx),
    [data, appIdx]
  );

  const statusOptions = useMemo(
    () => uniqueValues(statusIdx),
    [data, statusIdx]
  );

  const statusAtualizacaoOptions = useMemo(
    () => uniqueValues(statusAtualizacaoIdx),
    [data, statusAtualizacaoIdx]
  );

  const versoes = useMemo(
    () => uniqueValues(versaoIdx),
    [data, versaoIdx]
  );

  const totalEquipamentos = rows.length;

  const totalAtivos =
    statusIdx !== -1
      ? rows.filter(
          (row) =>
            String(row[statusIdx] || "")
              .trim()
              .toUpperCase() === "A"
        ).length
      : 0;

  const totalInativos =
    statusIdx !== -1
      ? rows.filter(
          (row) =>
            String(row[statusIdx] || "")
              .trim()
              .toUpperCase() === "I"
        ).length
      : 0;

  const totalManutencao =
    statusIdx !== -1
      ? rows.filter(
          (row) =>
            String(row[statusIdx] || "")
              .trim()
              .toUpperCase() === "M"
        ).length
      : 0;

  const totalAtualizados =
    statusAtualizacaoIdx !== -1
      ? rows.filter((row) => {
          const value = normalizeValue(
            row[statusAtualizacaoIdx] || ""
          );

          return value === "atualizado";
        }).length
      : 0;

  const totalPendentes =
    statusAtualizacaoIdx !== -1
      ? rows.filter((row) => {
          const value = normalizeValue(
            row[statusAtualizacaoIdx] || ""
          );

          return value === "pendente";
        }).length
      : 0;

  const totalNaoLocalizados =
    statusAtualizacaoIdx !== -1
      ? rows.filter((row) => {
          const value = normalizeValue(
            row[statusAtualizacaoIdx] || ""
          );

          return value === "nao localizado";
        }).length
      : 0;

  const progressoAtualizacao =
    totalEquipamentos > 0
      ? Math.round(
          (totalAtualizados / totalEquipamentos) * 100
        )
      : 0;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const searchValue = normalizeValue(search);

      if (searchValue) {
        const searchableValues = [
          setorIdx,
          coletorIdx,
          snIdx,
          finalIdx,
          macIdx,
          ipIdx,
          appIdx,
          setorLocalizadoIdx,
          versaoIdx,
        ]
          .filter((index) => index !== -1)
          .map((index) =>
            normalizeValue(row[index] || "")
          );

        const matchesSearch = searchableValues.some(
          (value) => value.includes(searchValue)
        );

        if (!matchesSearch) {
          return false;
        }
      }

      if (
        setorFilter &&
        normalizeValue(row[setorIdx] || "") !==
          normalizeValue(setorFilter)
      ) {
        return false;
      }

      if (
        appFilter &&
        normalizeValue(row[appIdx] || "") !==
          normalizeValue(appFilter)
      ) {
        return false;
      }

      if (
        statusFilter &&
        normalizeValue(row[statusIdx] || "") !==
          normalizeValue(statusFilter)
      ) {
        return false;
      }

      if (
        statusAtualizacaoFilter &&
        normalizeValue(
          row[statusAtualizacaoIdx] || ""
        ) !== normalizeValue(statusAtualizacaoFilter)
      ) {
        return false;
      }

      if (
        versaoFilter &&
        normalizeValue(row[versaoIdx] || "") !==
          normalizeValue(versaoFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [
    rows,
    search,
    setorFilter,
    appFilter,
    statusFilter,
    statusAtualizacaoFilter,
    versaoFilter,
    setorIdx,
    coletorIdx,
    snIdx,
    finalIdx,
    macIdx,
    ipIdx,
    appIdx,
    setorLocalizadoIdx,
    versaoIdx,
    statusIdx,
    statusAtualizacaoIdx,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    setorFilter,
    appFilter,
    statusFilter,
    statusAtualizacaoFilter,
    versaoFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / itemsPerPage)
  );

  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const clearFilters = () => {
    setSearch("");
    setSetorFilter("");
    setAppFilter("");
    setStatusFilter("");
    setStatusAtualizacaoFilter("");
    setVersaoFilter("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search ||
    setorFilter ||
    appFilter ||
    statusFilter ||
    statusAtualizacaoFilter ||
    versaoFilter;

  const getStatusLabel = (value: string) => {
    const status = String(value || "")
      .trim()
      .toUpperCase();

    switch (status) {
      case "A":
        return "Ativo";
      case "I":
        return "Inativo";
      case "M":
        return "Manutenção";
      default:
        return value || "Não informado";
    }
  };

  const getStatusStyle = (
    value: string
  ): React.CSSProperties => {
    const status = String(value || "")
      .trim()
      .toUpperCase();

    if (status === "A") {
      return {
        backgroundColor: "rgba(5, 150, 105, 0.14)",
        color: "#10B981",
        border: "1px solid rgba(16, 185, 129, 0.35)",
      };
    }

    if (status === "M") {
      return {
        backgroundColor: "rgba(245, 158, 11, 0.14)",
        color: "#F59E0B",
        border: "1px solid rgba(245, 158, 11, 0.35)",
      };
    }

    if (status === "I") {
      return {
        backgroundColor: "rgba(100, 116, 139, 0.14)",
        color: "var(--text-muted)",
        border: "1px solid var(--border-primary)",
      };
    }

    return {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-muted)",
      border: "1px solid var(--border-primary)",
    };
  };

  const getUpdateStatusStyle = (
    value: string
  ): React.CSSProperties => {
    const status = normalizeValue(value);

    if (status === "atualizado") {
      return {
        backgroundColor: "rgba(5, 150, 105, 0.14)",
        color: "#10B981",
        border: "1px solid rgba(16, 185, 129, 0.35)",
      };
    }

    if (status === "pendente") {
      return {
        backgroundColor: "rgba(245, 158, 11, 0.14)",
        color: "#F59E0B",
        border: "1px solid rgba(245, 158, 11, 0.35)",
      };
    }

    if (status === "nao localizado") {
      return {
        backgroundColor: "rgba(220, 38, 38, 0.14)",
        color: "#EF4444",
        border: "1px solid rgba(239, 68, 68, 0.35)",
      };
    }

    if (status === "nao se aplica") {
      return {
        backgroundColor: "rgba(100, 116, 139, 0.14)",
        color: "var(--text-muted)",
        border: "1px solid var(--border-primary)",
      };
    }

    return {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-muted)",
      border: "1px solid var(--border-primary)",
    };
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
    borderRadius: "8px",
    fontSize: "13px",
    outline: "none",
    minHeight: "40px",
  };

  const cards = [
    {
      label: "Total de Equipamentos",
      value: totalEquipamentos,
      detail: `${totalAtivos} ativos`,
    },
    {
      label: "Atualizados",
      value: totalAtualizados,
      detail: `${progressoAtualizacao}% do total`,
    },
    {
      label: "Pendentes",
      value: totalPendentes,
      detail: "Aguardando atualização",
    },
    {
      label: "Não Localizados",
      value: totalNaoLocalizados,
      detail: "Conferência pendente",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "var(--text-primary)",
              fontSize: "24px",
            }}
          >
            Controle de Mobiles
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            Controle de equipamentos, versões e atualizações.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            padding: "10px 16px",
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-primary)",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          ↻ Atualizar
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "16px",
        }}
      >
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              padding: "20px",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "12px",
            }}
          >
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "8px",
              }}
            >
              {card.label}
            </div>

            <div
              style={{
                color: "var(--text-primary)",
                fontSize: "28px",
                fontWeight: 700,
              }}
            >
              {card.value}
            </div>

            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "12px",
                marginTop: "6px",
              }}
            >
              {card.detail}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: "8px",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          Ativos:{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {totalAtivos}
          </strong>
        </div>

        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: "8px",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          Manutenção:{" "}
          <strong style={{ color: "#F59E0B" }}>
            {totalManutencao}
          </strong>
        </div>

        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: "8px",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          Inativos:{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {totalInativos}
          </strong>
        </div>
      </div>

      <div
        style={{
          padding: "18px",
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-primary)",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(220px, 2fr) repeat(5, minmax(140px, 1fr))",
            gap: "12px",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Pesquisar Coletor, SN, IP, MAC..."
            style={inputStyle}
          />

          <select
            value={setorFilter}
            onChange={(event) =>
              setSetorFilter(event.target.value)
            }
            style={inputStyle}
          >
            <option value="">Todos os setores</option>

            {setores.map((setor) => (
              <option key={setor} value={setor}>
                {setor}
              </option>
            ))}
          </select>

          <select
            value={appFilter}
            onChange={(event) =>
              setAppFilter(event.target.value)
            }
            style={inputStyle}
          >
            <option value="">Todos os apps</option>

            {apps.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            style={inputStyle}
          >
            <option value="">Todos os status</option>

            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
              </option>
            ))}
          </select>

          <select
            value={statusAtualizacaoFilter}
            onChange={(event) =>
              setStatusAtualizacaoFilter(
                event.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              Todos os status de atualização
            </option>

            {statusAtualizacaoOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={versaoFilter}
            onChange={(event) =>
              setVersaoFilter(event.target.value)
            }
            style={inputStyle}
          >
            <option value="">Todas as versões</option>

            {versoes.map((versao) => (
              <option key={versao} value={versao}>
                {versao}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={clearFilters}
              style={{
                padding: "8px 14px",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-muted)",
                border:
                  "1px solid var(--border-primary)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div
          style={{
            padding: "24px",
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: "12px",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          Carregando equipamentos...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: "16px",
            borderRadius: "10px",
            backgroundColor:
              "rgba(220, 38, 38, 0.12)",
            border: "1px solid #DC2626",
            color: "#DC2626",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && data.length <= 1 && (
        <div
          style={{
            padding: "24px",
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: "12px",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          Nenhum equipamento encontrado na aba
          tbControleMobiles.
        </div>
      )}

      {!loading && !error && data.length > 1 && (
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom:
                "1px solid var(--border-primary)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong
                style={{
                  color: "var(--text-primary)",
                }}
              >
                Equipamentos cadastrados
              </strong>

              <span
                style={{
                  marginLeft: "10px",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                {filteredRows.length} de{" "}
                {totalEquipamentos} registros
              </span>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1180px",
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
                    "Setor",
                    "Coletor",
                    "SN",
                    "IP",
                    "App de uso",
                    "Versão",
                    "Data atualização",
                    "Status atualização",
                    "Status",
                  ].map((title) => (
                    <th
                      key={title}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        color: "var(--text-muted)",
                        fontSize: "12px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
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
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: "28px",
                        textAlign: "center",
                        color: "var(--text-muted)",
                      }}
                    >
                      Nenhum equipamento encontrado com os
                      filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, index) => {
                    const globalIndex =
                      (currentPage - 1) *
                        itemsPerPage +
                      index;

                    return (
                      <tr
                        key={`${row[coletorIdx] || "mobile"}-${
                          row[snIdx] || globalIndex
                        }-${globalIndex}`}
                        style={{
                          borderBottom:
                            "1px solid var(--border-primary)",
                        }}
                      >
                        <td
                          style={{
                            padding: "12px 14px",
                            color:
                              "var(--text-primary)",
                            fontSize: "13px",
                          }}
                        >
                          {setorIdx !== -1
                            ? row[setorIdx] || "-"
                            : "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px 14px",
                            color:
                              "var(--text-primary)",
                            fontSize: "13px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {coletorIdx !== -1
                            ? row[coletorIdx] || "-"
                            : "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px 14px",
                            color:
                              "var(--text-secondary)",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {snIdx !== -1
                            ? row[snIdx] || "-"
                            : "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px 14px",
                            color:
                              "var(--text-secondary)",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {ipIdx !== -1
                            ? row[ipIdx] || "-"
                            : "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px 14px",
                            color:
                              "var(--text-primary)",
                            fontSize: "13px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {appIdx !== -1
                            ? row[appIdx] || "-"
                            : "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px 14px",
                            color:
                              "var(--text-primary)",
                            fontSize: "13px",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {versaoIdx !== -1
                            ? row[versaoIdx] || "-"
                            : "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px 14px",
                            color:
                              "var(--text-secondary)",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {dataAtualizacaoIdx !== -1
                            ? row[
                                dataAtualizacaoIdx
                              ] || "-"
                            : "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px 14px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              display:
                                "inline-flex",
                              alignItems: "center",
                              padding: "5px 9px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                              ...getUpdateStatusStyle(
                                statusAtualizacaoIdx !==
                                  -1
                                  ? row[
                                      statusAtualizacaoIdx
                                    ] || ""
                                  : ""
                              ),
                            }}
                          >
                            {statusAtualizacaoIdx !== -1
                              ? row[
                                  statusAtualizacaoIdx
                                ] || "Sem informação"
                              : "Sem informação"}
                          </span>
                        </td>

                        <td
                          style={{
                            padding: "12px 14px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              display:
                                "inline-flex",
                              alignItems: "center",
                              padding: "5px 9px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                              ...getStatusStyle(
                                statusIdx !== -1
                                  ? row[statusIdx] || ""
                                  : ""
                              ),
                            }}
                          >
                            {statusIdx !== -1
                              ? getStatusLabel(
                                  row[statusIdx] || ""
                                )
                              : "Não informado"}
                          </span>
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
              padding: "14px 18px",
              borderTop:
                "1px solid var(--border-primary)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.max(1, page - 1)
                )
              }
              style={{
                padding: "8px 14px",
                backgroundColor:
                  "var(--bg-primary)",
                color:
                  currentPage === 1
                    ? "var(--text-muted)"
                    : "var(--text-primary)",
                border:
                  "1px solid var(--border-primary)",
                borderRadius: "8px",
                cursor:
                  currentPage === 1
                    ? "not-allowed"
                    : "pointer",
                fontSize: "12px",
                fontWeight: 600,
                opacity:
                  currentPage === 1 ? 0.6 : 1,
              }}
            >
              ← Anterior
            </button>

            <span
              style={{
                color: "var(--text-muted)",
                fontSize: "12px",
              }}
            >
              Página{" "}
              <strong
                style={{
                  color: "var(--text-primary)",
                }}
              >
                {currentPage}
              </strong>{" "}
              de{" "}
              <strong
                style={{
                  color: "var(--text-primary)",
                }}
              >
                {totalPages}
              </strong>
            </span>

            <button
              type="button"
              disabled={
                currentPage === totalPages
              }
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(
                    totalPages,
                    page + 1
                  )
                )
              }
              style={{
                padding: "8px 14px",
                backgroundColor:
                  "var(--bg-primary)",
                color:
                  currentPage === totalPages
                    ? "var(--text-muted)"
                    : "var(--text-primary)",
                border:
                  "1px solid var(--border-primary)",
                borderRadius: "8px",
                cursor:
                  currentPage === totalPages
                    ? "not-allowed"
                    : "pointer",
                fontSize: "12px",
                fontWeight: 600,
                opacity:
                  currentPage === totalPages
                    ? 0.6
                    : 1,
              }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}