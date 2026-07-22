import React from "react";

type SortConfig = {
  columnIndex: number | null;
  direction: "asc" | "desc";
};

type RowWithOriginalIndex = string[] & {
  _originalIndex?: number;
};

interface ChamadosTableProps {
  loading: boolean;
  error: string | null;
  headers: string[][];
  sortedData: string[][];
  currentPage: number;
  itemsPerPage: number;
  sortConfig: SortConfig;
  normalize: (value: string) => string;
  onSort: (columnIndex: number) => void;
  onEdit: (row: string[]) => void;
  onToggleCobranca: (
    row: string[],
    rowIndex: number
  ) => void;
  onConcluir: (row: string[]) => void;
}

const formatDateBR = (dateString: string) => {
  if (!dateString) {
    return "";
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return dateString;
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date
    .toLocaleDateString("pt-BR", {
      timeZone: "UTC"
    })
    .split(",")[0];
};

const getTableColumnStyle = (
  header: string,
  normalize: (value: string) => string
): React.CSSProperties => {
  const name = normalize(header);

  if (
    name.includes("numero") &&
    name.includes("chamado")
  ) {
    return {
      width: "7%",
      minWidth: 0
    };
  }

  if (name === "titulo") {
    return {
      width: "12%",
      minWidth: 0
    };
  }

  if (
    name.includes("descricao") &&
    name.includes("problema")
  ) {
    return {
      width: "25%",
      minWidth: 0,
      whiteSpace: "normal",
      wordBreak: "break-word",
      overflowWrap: "anywhere"
    };
  }

  if (name === "situacao") {
    return {
      width: "9%",
      minWidth: 0
    };
  }

  if (
    name.includes("os") &&
    name.includes("aberta")
  ) {
    return {
      width: "7%",
      minWidth: 0
    };
  }

  if (name.includes("data")) {
    return {
      width: "9%",
      minWidth: 0
    };
  }

  if (name === "gravidade") {
    return {
      width: "8%",
      minWidth: 0
    };
  }

  if (name === "responsavel") {
    return {
      width: "10%",
      minWidth: 0
    };
  }

  if (
    name.includes("ticket") &&
    name.includes("referencia")
  ) {
    return {
      width: "9%",
      minWidth: 0
    };
  }

  if (
    name.includes("metodo") &&
    name.includes("acionamento")
  ) {
    return {
      width: "10%",
      minWidth: 0
    };
  }

  return {
    width: "8%",
    minWidth: 0
  };
};

export default function ChamadosTable({
  loading,
  error,
  headers,
  sortedData,
  currentPage,
  itemsPerPage,
  sortConfig,
  normalize,
  onSort,
  onEdit,
  onToggleCobranca,
  onConcluir
}: ChamadosTableProps) {
  if (loading && headers.length === 0) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          backgroundColor: "#1E293B",
          borderRadius: "12px",
          color: "#94A3B8"
        }}
      >
        Carregando dados da planilha...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "20px",
          backgroundColor: "#FEF2F2",
          border: "1px solid #FEE2E2",
          borderRadius: "10px",
          color: "#DC2626"
        }}
      >
        <strong>Erro:</strong> {error}
      </div>
    );
  }

  const tableHeaders = headers[0] || [];
  const startIndex =
    (currentPage - 1) * itemsPerPage;

  const paginatedData = sortedData.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const situacaoIdx = tableHeaders.findIndex(
    header => normalize(header) === "situacao"
  );

  const gravidadeIdx = tableHeaders.findIndex(
    header => normalize(header) === "gravidade"
  );

  const cobrancaIdx = tableHeaders.findIndex(
    header => normalize(header) === "cobranca"
  );

  return (
    <div
      className="table-wrapper"
      style={{
        width: "100%",
        overflow: "hidden",
        backgroundColor: "#1E293B",
        borderRadius: "12px",
        border: "1px solid #334155",
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
      }}
    >
      <div
        className="table-scroll"
        style={{
          width: "100%",
          overflowX: "auto",
          overflowY: "visible",
          scrollbarWidth: "auto"
        }}
      >
        <style>{`
          .table-scroll thead th {
            position: sticky;
            top: 0;
            z-index: 10;
            background-color: #0F172A;
            border-bottom: 2px solid #334155;
          }

          .table-scroll td:first-child,
          .table-scroll th:first-child {
            position: sticky;
            left: 0;
            z-index: 11;
            border-right: 2px solid #334155;
            background-color: inherit;
          }

          .table-scroll th:first-child {
            z-index: 12;
          }

          .table-scroll td,
          .table-scroll th {
            min-width: 0;
            max-width: none;
            overflow: hidden;
            text-overflow: ellipsis;
            padding: 10px 8px;
            border-bottom: 1px solid #334155;
            vertical-align: middle;
            box-sizing: border-box;
          }

          .table-scroll {
            scrollbar-width: auto;
            scrollbar-color: #475569 #1E293B;
          }

          .table-scroll::-webkit-scrollbar {
            height: 12px;
            background: #1E293B;
            display: block !important;
          }

          .table-scroll::-webkit-scrollbar-thumb {
            background: #475569;
            border-radius: 6px;
            border: 3px solid #1E293B;
          }

          .table-scroll::-webkit-scrollbar-thumb:hover {
            background: #64748B;
          }
        `}</style>

        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize:
              "clamp(11px, 0.75vw, 13px)",
            color: "#E2E8F0",
            tableLayout: "fixed"
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#0F172A"
              }}
            >
              {tableHeaders.map((header, index) => {
                const normalizedHeader =
                  normalize(header);

                if (
                  normalizedHeader === "cobranca" ||
                  normalizedHeader === "excluido"
                ) {
                  return null;
                }

                return (
                  <th
                    key={index}
                    onClick={() => onSort(index)}
                    title={`Ordenar por ${header}`}
                    style={{
                      textAlign: "left",
                      fontWeight: "bold",
                      color:
                        sortConfig.columnIndex ===
                        index
                          ? "#F8FAFC"
                          : "#94A3B8",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                      userSelect: "none",
                      transition: "color 0.2s",
                      ...getTableColumnStyle(
                        header,
                        normalize
                      )
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {header}

                      {sortConfig.columnIndex ===
                        index && (
                        <span
                          style={{
                            color: "#3B82F6",
                            fontSize: "12px"
                          }}
                        >
                          {sortConfig.direction ===
                          "asc"
                            ? "▲"
                            : "▼"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}

              <th
                style={{
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#94A3B8",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: "0.5px",
                  padding: "8px 4px",
                  width: "55px",
                  minWidth: "55px",
                  maxWidth: "55px"
                }}
              >
                Ações
              </th>

              <th
                style={{
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#94A3B8",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: "0.5px",
                  padding: "8px 4px",
                  width: "55px",
                  minWidth: "55px",
                  maxWidth: "55px"
                }}
              >
                Cobrança
              </th>

              <th
                style={{
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#94A3B8",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: "0.5px",
                  padding: "8px 4px",
                  width: "95px",
                  minWidth: "95px",
                  maxWidth: "95px"
                }}
              >
                Concluir
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((row, index) => {
              const rowWithIndex =
                row as RowWithOriginalIndex;

              const originalRowIndex =
                rowWithIndex._originalIndex;

              const situacaoValue =
                situacaoIdx !== -1
                  ? (row[situacaoIdx] || "")
                      .trim()
                      .toLowerCase()
                  : "";

              const isRowGreen =
                situacaoValue === "concluído" ||
                situacaoValue === "finalizado";

              const rowBackground =
                index % 2 === 0
                  ? "#1E293B"
                  : "#1a2434";

              const activeRowBackground =
                isRowGreen
                  ? "#065F46"
                  : rowBackground;

              return (
                <tr
                  key={
                    originalRowIndex ??
                    startIndex + index
                  }
                  style={{
                    backgroundColor:
                      activeRowBackground,
                    transition:
                      "background 0.2s"
                  }}
                  onMouseOver={event => {
                    event.currentTarget.style.backgroundColor =
                      isRowGreen
                        ? "#064E3B"
                        : "#334155";
                  }}
                  onMouseOut={event => {
                    event.currentTarget.style.backgroundColor =
                      activeRowBackground;
                  }}
                >
                  {tableHeaders.map(
                    (header, columnIndex) => {
                      const normalizedHeader =
                        normalize(header);

                      if (
                        normalizedHeader ===
                          "cobranca" ||
                        normalizedHeader ===
                          "excluido"
                      ) {
                        return null;
                      }

                      let cell =
                        row[columnIndex] || "";

                      if (
                        normalizedHeader.includes(
                          "data"
                        )
                      ) {
                        cell = formatDateBR(cell);
                      }

                      if (
                        columnIndex === gravidadeIdx
                      ) {
                        const gravityValue = cell
                          .trim()
                          .toLowerCase();

                        const labelStyle: React.CSSProperties =
                          {
                            fontWeight: "bold",
                            borderRadius: "4px",
                            padding: "4px 8px",
                            display: "inline-block",
                            fontSize: "11px"
                          };

                        if (
                          gravityValue === "crítico"
                        ) {
                          labelStyle.backgroundColor =
                            "#7F1D1D";
                          labelStyle.color =
                            "#FCA5A5";
                        } else if (
                          gravityValue === "urgente"
                        ) {
                          labelStyle.backgroundColor =
                            "#78350F";
                          labelStyle.color =
                            "#FCD34D";
                        } else if (
                          gravityValue ===
                          "intermediário"
                        ) {
                          labelStyle.backgroundColor =
                            "#451a03";
                          labelStyle.color =
                            "#fbbf24";
                        } else if (
                          gravityValue === "baixa"
                        ) {
                          labelStyle.backgroundColor =
                            "#064E3B";
                          labelStyle.color =
                            "#6EE7B7";
                        }

                        return (
                          <td key={columnIndex}>
                            <span
                              style={labelStyle}
                            >
                              {cell}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={columnIndex}
                          style={getTableColumnStyle(
                            header,
                            normalize
                          )}
                        >
                          {cell}
                        </td>
                      );
                    }
                  )}

                  <td
                    style={{
                      textAlign: "center",
                      padding: "12px 16px"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#3B82F6",
                        cursor: "pointer",
                        fontSize: "16px",
                        padding: "4px",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition:
                          "background 0.2s"
                      }}
                      onMouseOver={event => {
                        event.currentTarget.style.backgroundColor =
                          "#334155";
                      }}
                      onMouseOut={event => {
                        event.currentTarget.style.backgroundColor =
                          "transparent";
                      }}
                      title="Editar Registro"
                    >
                      ✏️
                    </button>
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      padding: "12px 16px"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        cobrancaIdx !== -1 &&
                        (
                          row[cobrancaIdx] || ""
                        )
                          .trim()
                          .toUpperCase() === "SIM"
                      }
                      onChange={() => {
                        if (
                          cobrancaIdx === -1 ||
                          originalRowIndex ===
                            undefined
                        ) {
                          return;
                        }

                        const nextRow = [...row];

                        nextRow[cobrancaIdx] =
                          (
                            row[cobrancaIdx] || ""
                          )
                            .trim()
                            .toUpperCase() === "SIM"
                            ? "NAO"
                            : "SIM";

                        onToggleCobranca(
                          nextRow,
                          originalRowIndex
                        );
                      }}
                      style={{
                        width: "18px",
                        height: "18px",
                        cursor: "pointer",
                        accentColor: "#EF4444"
                      }}
                    />
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      padding: "8px"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onConcluir(row)}
                      style={{
                        backgroundColor: "#10B981",
                        color: "#FFF",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "bold",
                        transition: "0.2s"
                      }}
                      onMouseOver={event => {
                        event.currentTarget.style.backgroundColor =
                          "#059669";
                      }}
                      onMouseOut={event => {
                        event.currentTarget.style.backgroundColor =
                          "#10B981";
                      }}
                    >
                      ✓ Concluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}