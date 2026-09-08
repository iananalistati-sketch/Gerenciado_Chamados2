import React, { useEffect, useState } from "react";
import SubstituirMobileModal from "./SubstituirMobileModal";

interface EditarMobileModalProps {
  isOpen: boolean;
  row: string[] | null;
  headers: string[];
  allRows: string[][];
  currentUserName: string;
  normalize: (value: string) => string;
  onClose: () => void;
  onSave: (rowData: string[], rowIndex: number) => Promise<void>;
  onRefresh: () => void | Promise<void>;
}

export default function EditarMobileModal({
  isOpen,
  row,
  headers,
  allRows,
  currentUserName,
  normalize,
  onClose,
  onSave,
  onRefresh,
}: EditarMobileModalProps) {
  const [formData, setFormData] =
    useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [returning, setReturning] = useState(false);
  const [showSubstitute, setShowSubstitute] = useState(false);

  useEffect(() => {
    if (!isOpen || !row) {
      return;
    }

    const values: Record<string, string> = {};

    headers.forEach((header, index) => {
      values[header] = row[index] || "";
    });

    setFormData(values);
    setShowSubstitute(false);
  }, [isOpen, row, headers]);

  if (!isOpen || !row) {
    return null;
  }

  const getHeader = (...names: string[]) =>
    headers.find((header) =>
      names.some(
        (name) =>
          normalize(header) === normalize(name)
      )
    );

  const setorHeader = getHeader("Setor");
  const coletorHeader = getHeader("Coletor");
  const snHeader = getHeader("SN");
  const finalHeader = getHeader("FINAL");
  const macHeader = getHeader("MAC");
  const ipHeader = getHeader("IP");
  const entregueHeader = getHeader("Entregue");
  const obsHeader = getHeader("Obs");
  const dataAtualizacaoHeader = getHeader(
    "Data atualização",
    "Data atualizacao"
  );
  const appHeader = getHeader("App de uso");
  const setorLocalizadoHeader = getHeader(
    "Setor localizado"
  );
  const versaoHeader = getHeader(
    "Versão",
    "Versao"
  );
  const contadorHeader = getHeader(
    "Contador atualização",
    "Contador atualizacao"
  );
  const statusHeader = getHeader("Status");
  const statusAtualizacaoHeader = getHeader(
    "Status atualização",
    "Status atualizacao"
  );
  const responsavelAtualizacaoHeader = getHeader(
    "Responsável atualização",
    "Responsavel atualizacao"
  );

  const currentStatus = statusHeader
    ? String(formData[statusHeader] || "").trim().toUpperCase()
    : "";
  const currentSector = setorHeader
    ? String(formData[setorHeader] || "").trim()
    : "";
  const currentCollector = coletorHeader
    ? String(formData[coletorHeader] || "").trim()
    : "";
  const currentLocation = setorLocalizadoHeader
    ? String(formData[setorLocalizadoHeader] || "").trim()
    : "";

  const canTemporarilyReplace =
    currentStatus === "A" &&
    normalize(currentSector) !== normalize("TI-SUPORTE");

  const canFinalizeLoan =
    currentStatus === "E" &&
    normalize(currentSector) === normalize("TI-SUPORTE");

  const isOperationalStatus =
    currentStatus === "M" || currentStatus === "E";

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "A":
        return "Ativo";
      case "I":
        return "Inativo";
      case "M":
        return "Manutenção";
      case "E":
        return "Emprestado";
      default:
        return status || "Não informado";
    }
  };

  const handleChange = (
    header: string | undefined,
    value: string
  ) => {
    if (!header) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      [header]: value,
    }));
  };

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

  const handleFinalizeLoan = async () => {
    if (!canFinalizeLoan || !currentCollector) {
      return;
    }

    const confirmed = window.confirm(
      `Finalizar o empréstimo do equipamento reserva "${currentCollector}"?\n\nO equipamento original voltará para Ativo e a reserva ficará disponível novamente.`
    );

    if (!confirmed) {
      return;
    }

    const updateLocation = window.confirm(
      "Deseja atualizar o setor de localização na devolução?\n\nSe confirmar, a reserva retornará para TI-SUPORTE e você poderá informar o setor onde o equipamento original será devolvido."
    );

    let returnSector = "";

    if (updateLocation) {
      const informedSector = window.prompt(
        "Informe o setor de localização para devolução do equipamento original:",
        currentLocation || currentSector || ""
      );

      if (informedSector === null) {
        return;
      }

      returnSector = informedSector.trim();

      if (!returnSector) {
        alert("Informe o setor de localização da devolução.");
        return;
      }
    }

    const observation = window.prompt(
      "Observação da devolução (opcional):",
      ""
    );

    if (observation === null) {
      return;
    }

    setReturning(true);

    try {
      const response = await fetch(
        "/api/mobiles/loan-return",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reserveCollector: currentCollector,
            responsible: currentUserName,
            observation: observation.trim(),
            updateLocation,
            returnSector,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Erro ao finalizar empréstimo temporário."
        );
      }

      await Promise.resolve(onRefresh());

      alert(
        `Empréstimo ${result.loanId || ""} finalizado com sucesso. O equipamento reserva voltou a ficar disponível.`.trim()
      );

      onClose();
    } catch (error: any) {
      alert(
        "Erro ao finalizar empréstimo: " +
          (error.message || "Erro desconhecido")
      );
    } finally {
      setReturning(false);
    }
  };

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!coletorHeader || !snHeader || !statusHeader) {
      alert(
        "Não foi possível identificar as colunas Coletor, SN ou Status."
      );

      return;
    }

    const coletor = String(
      formData[coletorHeader] || ""
    ).trim();

    const sn = String(
      formData[snHeader] || ""
    ).trim();

    const status = String(
      formData[statusHeader] || ""
    )
      .trim()
      .toUpperCase();

    const originalStatusIdx = headers.findIndex(
      (header) => normalize(header) === normalize("Status")
    );
    const originalStatus =
      originalStatusIdx !== -1
        ? String(row[originalStatusIdx] || "").trim().toUpperCase()
        : "";

    if (
      (status === "M" || status === "E") &&
      status !== originalStatus
    ) {
      alert(
        "Os status Manutenção e Emprestado são controlados automaticamente pela rotina de empréstimo e não podem ser definidos manualmente."
      );
      return;
    }

    if (!coletor) {
      alert("Informe o Coletor.");
      return;
    }

    if (!sn) {
      alert("Informe o SN do equipamento.");
      return;
    }

    if (!status) {
      alert("Informe o Status do equipamento.");
      return;
    }

    const currentRowIndex =
      (row as any)._originalIndex;

    if (
      currentRowIndex === undefined ||
      currentRowIndex === null
    ) {
      alert(
        "Não foi possível identificar a linha original do equipamento."
      );

      return;
    }

    const snIdx = headers.findIndex(
      (header) =>
        normalize(header) === normalize("SN")
    );

    const coletorIdx = headers.findIndex(
      (header) =>
        normalize(header) ===
        normalize("Coletor")
    );

    const statusIdx = headers.findIndex(
      (header) =>
        normalize(header) ===
        normalize("Status")
    );

    const duplicateSn = allRows.some(
      (otherRow) => {
        const otherRowIndex =
          (otherRow as any)._originalIndex;

        if (otherRowIndex === currentRowIndex) {
          return false;
        }

        const otherSn = String(
          otherRow[snIdx] || ""
        ).trim();

        return (
          normalize(otherSn) === normalize(sn)
        );
      }
    );

    if (duplicateSn) {
      alert(
        `Já existe outro equipamento cadastrado com o SN "${sn}".`
      );

      return;
    }

    if (status === "A") {
      const activeCollectorExists =
        allRows.some((otherRow) => {
          const otherRowIndex =
            (otherRow as any)._originalIndex;

          if (
            otherRowIndex === currentRowIndex
          ) {
            return false;
          }

          const otherCollector = String(
            otherRow[coletorIdx] || ""
          ).trim();

          const otherStatus = String(
            otherRow[statusIdx] || ""
          )
            .trim()
            .toUpperCase();

          return (
            normalize(otherCollector) ===
              normalize(coletor) &&
            otherStatus === "A"
          );
        });

      if (activeCollectorExists) {
        alert(
          `Já existe outro equipamento ATIVO utilizando o Coletor "${coletor}".`
        );

        return;
      }
    }

    const updatedData = {
      ...formData,
    };

    if (versaoHeader) {
      const versaoIdx =
        headers.indexOf(versaoHeader);

      const originalVersion = String(
        row[versaoIdx] || ""
      ).trim();

      const newVersion = String(
        updatedData[versaoHeader] || ""
      ).trim();

      if (originalVersion !== newVersion) {
        if (dataAtualizacaoHeader) {
          updatedData[dataAtualizacaoHeader] =
            getToday();
        }

        if (responsavelAtualizacaoHeader) {
          updatedData[
            responsavelAtualizacaoHeader
          ] = currentUserName;
        }

        if (contadorHeader) {
          const contadorIdx =
            headers.indexOf(contadorHeader);

          const originalCounter =
            Number(
              String(
                row[contadorIdx] || "0"
              )
                .trim()
                .replace(",", ".")
            ) || 0;

          updatedData[contadorHeader] =
            String(originalCounter + 1);
        }
      }
    }

    const updatedRow = headers.map(
      (header) => updatedData[header] || ""
    );

    setSaving(true);

    try {
      await onSave(
        updatedRow,
        currentRowIndex
      );

      onClose();
    } catch (error: any) {
      alert(
        "Erro ao salvar equipamento: " +
          error.message
      );
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
    borderRadius: "8px",
    fontSize: "13px",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: 600,
  };

  const field = (
    header: string | undefined,
    label: string,
    type: "text" | "select" | "textarea" = "text",
    options: Array<{
      value: string;
      label: string;
    }> = []
  ) => {
    if (!header) {
      return null;
    }

    return (
      <label style={labelStyle}>
        {label}

        {type === "select" ? (
          <select
            value={formData[header] || ""}
            onChange={(event) =>
              handleChange(
                header,
                event.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              Selecione
            </option>

            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        ) : type === "textarea" ? (
          <textarea
            value={formData[header] || ""}
            onChange={(event) =>
              handleChange(
                header,
                event.target.value
              )
            }
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
            }}
          />
        ) : (
          <input
            type="text"
            value={formData[header] || ""}
            onChange={(event) =>
              handleChange(
                header,
                event.target.value
              )
            }
            style={inputStyle}
          />
        )}
      </label>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor:
          "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        zIndex: 1100,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor:
            "var(--bg-secondary)",
          border:
            "1px solid var(--border-primary)",
          borderRadius: "14px",
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        <form onSubmit={handleSubmit}>
          <div
            style={{
              padding: "20px 22px",
              borderBottom:
                "1px solid var(--border-primary)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  color:
                    "var(--text-primary)",
                  fontSize: "20px",
                }}
              >
                Editar Equipamento
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                {coletorHeader
                  ? formData[
                      coletorHeader
                    ] || "Equipamento"
                  : "Equipamento"}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving || returning}
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
              padding: "22px",
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "18px",
            }}
          >
            {field(setorHeader, "Setor")}
            {field(setorLocalizadoHeader, "Setor localizado")}
            {field(coletorHeader, "Coletor")}
            {field(snHeader, "SN")}
            {field(finalHeader, "FINAL")}
            {field(macHeader, "MAC")}
            {field(ipHeader, "IP")}
            {field(appHeader, "App de uso")}
            {field(entregueHeader, "Entregue")}
            {field(versaoHeader, "Versão")}

            {statusHeader && (
              isOperationalStatus ? (
                <label style={labelStyle}>
                  Status
                  <input
                    type="text"
                    value={getStatusLabel(currentStatus)}
                    readOnly
                    style={{
                      ...inputStyle,
                      cursor: "not-allowed",
                      opacity: 0.75,
                    }}
                  />
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "10px",
                      fontWeight: 500,
                    }}
                  >
                    Status controlado automaticamente pela rotina de empréstimo.
                  </span>
                </label>
              ) : (
                field(
                  statusHeader,
                  "Status",
                  "select",
                  [
                    { value: "A", label: "Ativo" },
                    { value: "I", label: "Inativo" },
                  ]
                )
              )
            )}

            {statusAtualizacaoHeader && (
              <label style={labelStyle}>
                Status atualização
                <input
                  type="text"
                  value={formData[statusAtualizacaoHeader] || ""}
                  readOnly
                  style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.7 }}
                />
              </label>
            )}

            {dataAtualizacaoHeader && (
              <label style={labelStyle}>
                Data atualização
                <input
                  type="text"
                  value={formData[dataAtualizacaoHeader] || ""}
                  readOnly
                  style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.7 }}
                />
              </label>
            )}

            {contadorHeader && (
              <label style={labelStyle}>
                Contador atualização
                <input
                  type="text"
                  value={formData[contadorHeader] || ""}
                  readOnly
                  style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.7 }}
                />
              </label>
            )}

            {responsavelAtualizacaoHeader && (
              <label style={labelStyle}>
                Responsável atualização
                <input
                  type="text"
                  value={formData[responsavelAtualizacaoHeader] || ""}
                  readOnly
                  style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.7 }}
                />
              </label>
            )}

            {obsHeader && (
              <div style={{ gridColumn: "1 / -1" }}>
                {field(obsHeader, "Observação", "textarea")}
              </div>
            )}
          </div>

          <div
            style={{
              padding: "16px 22px",
              borderTop:
                "1px solid var(--border-primary)",
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {canTemporarilyReplace && (
                <button
                  type="button"
                  onClick={() => setShowSubstitute(true)}
                  disabled={saving || returning}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: "rgba(245, 158, 11, 0.14)",
                    color: "#F59E0B",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    borderRadius: "8px",
                    cursor: saving || returning ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  Substituir temporariamente
                </button>
              )}

              {canFinalizeLoan && (
                <button
                  type="button"
                  onClick={handleFinalizeLoan}
                  disabled={saving || returning}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: "rgba(16, 185, 129, 0.14)",
                    color: "#10B981",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    borderRadius: "8px",
                    cursor: saving || returning ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {returning
                    ? "Finalizando..."
                    : "Finalizar empréstimo"}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving || returning}
                style={{
                  padding: "10px 18px",
                  backgroundColor:
                    "var(--bg-primary)",
                  color:
                    "var(--text-primary)",
                  border:
                    "1px solid var(--border-primary)",
                  borderRadius: "8px",
                  cursor: saving || returning
                    ? "not-allowed"
                    : "pointer",
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving || returning}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#3B82F6",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  cursor: saving || returning
                    ? "not-allowed"
                    : "pointer",
                  fontWeight: 600,
                }}
              >
                {saving
                  ? "Salvando..."
                  : "Salvar alterações"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <SubstituirMobileModal
        isOpen={showSubstitute}
        equipment={row}
        headers={headers}
        allRows={allRows}
        currentUserName={currentUserName}
        normalize={normalize}
        onClose={() => setShowSubstitute(false)}
        onSuccess={async () => {
          await Promise.resolve(onRefresh());
          setShowSubstitute(false);
          onClose();
        }}
      />
    </div>
  );
}
