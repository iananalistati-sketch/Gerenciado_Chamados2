import React, { useEffect, useState } from "react";

interface NovoMobileModalProps {
  isOpen: boolean;
  headers: string[];
  allRows: string[][];
  normalize: (value: string) => string;
  onClose: () => void;
  onCreate: (rowData: string[]) => Promise<void>;
}

export default function NovoMobileModal({
  isOpen,
  headers,
  allRows,
  normalize,
  onClose,
  onCreate,
}: NovoMobileModalProps) {
  const [formData, setFormData] =
    useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  const getHeader = (...names: string[]) =>
    headers.find((header) =>
      names.some(
        (name) =>
          normalize(header) === normalize(name)
      )
    );

  const setorHeader = getHeader("Setor");
  const quantidadeHeader = getHeader("Quantidade");
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

  const appHeader = getHeader(
    "App de uso"
  );

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

  const statusHeader = getHeader(
    "Status"
  );

  const statusAtualizacaoHeader = getHeader(
    "Status atualização",
    "Status atualizacao"
  );

  const responsavelAtualizacaoHeader = getHeader(
    "Responsável atualização",
    "Responsavel atualizacao"
  );

  const ultimaConferenciaHeader = getHeader(
    "Última conferência",
    "Ultima conferencia"
  );

  const responsavelConferenciaHeader = getHeader(
    "Responsável conferência",
    "Responsavel conferencia"
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initialData: Record<string, string> = {};

    headers.forEach((header) => {
      initialData[header] = "";
    });

    if (statusHeader) {
      initialData[statusHeader] = "A";
    }

    if (contadorHeader) {
      initialData[contadorHeader] = "0";
    }

    setFormData(initialData);
  }, [
    isOpen,
    headers,
    statusHeader,
    contadorHeader,
  ]);

  if (!isOpen) {
    return null;
  }

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

    if (!coletor) {
      alert("Informe o Coletor.");
      return;
    }

    if (!sn) {
      alert("Informe o SN do equipamento.");
      return;
    }

    if (!["A", "I", "M"].includes(status)) {
      alert(
        "Informe um Status válido: Ativo, Inativo ou Manutenção."
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

    /*
     * SN é a identificação física do equipamento
     * e não pode existir em outro registro.
     */
    const duplicateSn = allRows.some(
      (row) => {
        const existingSn = String(
          row[snIdx] || ""
        ).trim();

        return (
          existingSn !== "" &&
          normalize(existingSn) ===
            normalize(sn)
        );
      }
    );

    if (duplicateSn) {
      alert(
        `Já existe um equipamento cadastrado com o SN "${sn}".`
      );

      return;
    }

    /*
     * O Coletor pode existir em registros históricos,
     * porém somente um deles pode estar Ativo.
     */
    if (status === "A") {
      const activeCollectorExists =
        allRows.some((row) => {
          const existingCollector = String(
            row[coletorIdx] || ""
          ).trim();

          const existingStatus = String(
            row[statusIdx] || ""
          )
            .trim()
            .toUpperCase();

          return (
            normalize(existingCollector) ===
              normalize(coletor) &&
            existingStatus === "A"
          );
        });

      if (activeCollectorExists) {
        alert(
          `Já existe um equipamento ATIVO utilizando o Coletor "${coletor}".`
        );

        return;
      }
    }

    const preparedData = {
      ...formData,
    };

    /*
     * Contador de atualização começa em zero.
     * Cadastro inicial não é tratado como
     * uma atualização de aplicativo.
     */
    if (contadorHeader) {
      preparedData[contadorHeader] = "0";
    }

    const rowData = headers.map(
      (header) =>
        preparedData[header] || ""
    );

    setSaving(true);

    try {
      await onCreate(rowData);
      onClose();
    } catch (error: any) {
      alert(
        "Erro ao cadastrar equipamento: " +
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
                Novo Equipamento
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                Cadastre um novo dispositivo no controle de mobiles.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
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
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
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
            {field(
              setorHeader,
              "Setor"
            )}

            {field(
              setorLocalizadoHeader,
              "Setor localizado"
            )}

            {field(
              coletorHeader,
              "Coletor"
            )}

            {field(
              snHeader,
              "SN"
            )}

            {field(
              finalHeader,
              "FINAL"
            )}

            {field(
              macHeader,
              "MAC"
            )}

            {field(
              ipHeader,
              "IP"
            )}

            {field(
              appHeader,
              "App de uso"
            )}

            {field(
              entregueHeader,
              "Entregue"
            )}

            {field(
              versaoHeader,
              "Versão"
            )}

            {field(
              statusHeader,
              "Status",
              "select",
              [
                {
                  value: "A",
                  label: "Ativo",
                },
                {
                  value: "I",
                  label: "Inativo",
                },
                {
                  value: "M",
                  label: "Manutenção",
                },
              ]
            )}

            {obsHeader && (
              <div
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                {field(
                  obsHeader,
                  "Observação",
                  "textarea"
                )}
              </div>
            )}
          </div>

          {/*
            Estes campos existem na planilha, porém não
            serão preenchidos manualmente no cadastro.
          */}
          <div style={{ display: "none" }}>
            {quantidadeHeader}
            {dataAtualizacaoHeader}
            {statusAtualizacaoHeader}
            {responsavelAtualizacaoHeader}
            {ultimaConferenciaHeader}
            {responsavelConferenciaHeader}
          </div>

          <div
            style={{
              padding: "16px 22px",
              borderTop:
                "1px solid var(--border-primary)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "10px 18px",
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
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 20px",
                backgroundColor: "#3B82F6",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
                fontWeight: 600,
              }}
            >
              {saving
                ? "Cadastrando..."
                : "Cadastrar equipamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}