import React from "react";

type CobrancaModalProps = {
  isOpen: boolean;
  data: string[][];
  selectedSheet: string;
  currentSheetCount: number;
  normalize: (value: string) => string;
  onClose: () => void;
  onSaveRow: (rowData: string[], rowIndex: number) => Promise<void>;
  onExport: () => void;
};

export default function CobrancaModal({
  isOpen,
  data,
  selectedSheet,
  currentSheetCount,
  normalize,
  onClose,
  onSaveRow,
  onExport
}: CobrancaModalProps) {
  if (!isOpen) return null;

  const headers = data[0] || [];
  const cobrancaIdx = headers.findIndex(h => normalize(h) === "cobranca");
  const gravidadeIdx = headers.findIndex(h => normalize(h) === "gravidade");

  const cobrancaData = data.slice(1).filter(row =>
    cobrancaIdx !== -1 &&
    (row[cobrancaIdx] || "").trim().toUpperCase() === "SIM"
  );

  const handleRemove = async (row: string[]) => {
    if (cobrancaIdx === -1) return;

    const rowIndex = (row as any)._originalIndex;

    if (rowIndex === undefined || rowIndex === null) {
      alert("Não foi possível identificar o índice original do chamado.");
      return;
    }

    const nextRow = [...row];
    nextRow[cobrancaIdx] = "NAO";
    await onSaveRow(nextRow, rowIndex);
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(2, 6, 23, 0.8)", display: "flex",
      justifyContent: "center", alignItems: "center", zIndex: 1000,
      padding: "20px", backdropFilter: "blur(8px)"
    }}>
      <div style={{
        backgroundColor: "#1E293B", padding: "30px", borderRadius: "16px",
        width: "100%", maxWidth: "1200px", maxHeight: "90vh",
        overflowY: "auto", border: "1px solid #334155",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#F8FAFC" }}>
            Tickets em Cobrança ({currentSheetCount})
          </h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#94A3B8" }}>
              Aba: <strong>{selectedSheet}</strong>
            </span>
            <button type="button" onClick={onClose} style={{
              backgroundColor: "transparent", border: "none", color: "#94A3B8",
              cursor: "pointer", fontSize: "24px"
            }}>&times;</button>
          </div>
        </div>

        {currentSheetCount === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
            Nenhum ticket da aba <strong>{selectedSheet}</strong> selecionado.
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto", border: "1px solid #334155", borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "13px", color: "#E2E8F0", minWidth: "1000px" }}>
              <thead>
                <tr style={{ backgroundColor: "#0F172A" }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{
                      padding: "16px", textAlign: "left", fontWeight: "bold",
                      color: "#94A3B8", textTransform: "uppercase",
                      fontSize: "11px", borderBottom: "1px solid #334155"
                    }}>{h}</th>
                  ))}
                  <th style={{ padding: "16px", borderBottom: "1px solid #334155" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cobrancaData.map((row, i) => (
                  <tr key={(row as any)._originalIndex ?? i} style={{ backgroundColor: i % 2 === 0 ? "#1E293B" : "#1a2434" }}>
                    {headers.map((_, j) => {
                      const cell = row[j] || "";
                      if (j === gravidadeIdx) {
                        const gravValue = cell.trim().toLowerCase();
                        const labelStyle: React.CSSProperties = {
                          fontWeight: "bold", borderRadius: "4px", padding: "4px 8px",
                          display: "inline-block", fontSize: "11px"
                        };
                        if (gravValue === "crítico") { labelStyle.backgroundColor = "#7F1D1D"; labelStyle.color = "#FCA5A5"; }
                        else if (gravValue === "urgente") { labelStyle.backgroundColor = "#78350F"; labelStyle.color = "#FCD34D"; }
                        else if (gravValue === "intermediário") { labelStyle.backgroundColor = "#451a03"; labelStyle.color = "#fbbf24"; }
                        else if (gravValue === "baixa") { labelStyle.backgroundColor = "#064E3B"; labelStyle.color = "#6EE7B7"; }
                        return <td key={j} style={{ padding: "12px 16px", borderBottom: "1px solid #334155" }}><span style={labelStyle}>{cell}</span></td>;
                      }
                      return <td key={j} style={{ padding: "12px 16px", borderBottom: "1px solid #334155" }}>{cell}</td>;
                    })}
                    <td style={{ padding: "12px 16px", borderBottom: "1px solid #334155", textAlign: "center" }}>
                      <button type="button" onClick={() => handleRemove(row)} style={{
                        backgroundColor: "#EF4444", color: "white", border: "none",
                        padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer"
                      }}>Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          {currentSheetCount > 0 && (
            <button type="button" onClick={onExport} style={{
              padding: "10px 20px", backgroundColor: "#10B981", color: "white",
              border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px"
            }}><span>📊</span> Exportar Excel</button>
          )}
          <button type="button" onClick={onClose} style={{
            padding: "10px 20px", backgroundColor: "#334155", color: "white",
            border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer"
          }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}