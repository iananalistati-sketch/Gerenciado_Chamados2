import React, { useEffect, useState } from "react";

interface AtualizacaoLoteMobilesModalProps {
  isOpen: boolean;
  selectedCount: number;
  currentUserName: string;
  onClose: () => void;

  onApply: (values: {
    versao: string;
    dataAtualizacao: string;
    status: string;
    statusAtualizacao: string;
    observacao: string;
  }) => Promise<void>;
}

export default function AtualizacaoLoteMobilesModal({
  isOpen,
  selectedCount,
  currentUserName,
  onClose,
  onApply,
}: AtualizacaoLoteMobilesModalProps) {
  const [versao, setVersao] = useState("");
  const [dataAtualizacao, setDataAtualizacao] =
    useState("");
  const [status, setStatus] = useState("");
  const [
    statusAtualizacao,
    setStatusAtualizacao,
  ] = useState("");
  const [observacao, setObservacao] =
    useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setVersao("");
    setDataAtualizacao("");
    setStatus("");
    setStatusAtualizacao("");
    setObservacao("");
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (
      !versao &&
      !dataAtualizacao &&
      !status &&
      !statusAtualizacao &&
      !observacao
    ) {
      alert(
        "Informe pelo menos um campo para atualizar."
      );
      return;
    }

    setSaving(true);

    try {
      await onApply({
        versao,
        dataAtualizacao,
        status,
        statusAtualizacao,
        observacao,
      });

      onClose();
    } catch (error: any) {
      alert(
        "Erro ao atualizar equipamentos: " +
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
        zIndex: 1200,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "650px",
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
                Atualização em Lote
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                {selectedCount} equipamento
                {selectedCount !== 1
                  ? "s"
                  : ""} selecionado
                {selectedCount !== 1
                  ? "s"
                  : ""}
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
            <label style={labelStyle}>
              Versão
              <input
                type="text"
                value={versao}
                onChange={(event) =>
                  setVersao(
                    event.target.value
                  )
                }
                placeholder="Ex.: 5.3.0"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Data atualização
              <input
                type="date"
                value={dataAtualizacao}
                onChange={(event) =>
                  setDataAtualizacao(
                    event.target.value
                  )
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Status operacional
              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value
                  )
                }
                style={inputStyle}
              >
                <option value="">
                  Não alterar
                </option>

                <option value="A">
                  Ativo
                </option>

                <option value="I">
                  Inativo
                </option>

                <option value="M">
                  Manutenção
                </option>
              </select>
            </label>

            <label style={labelStyle}>
              Status atualização
              <select
                value={statusAtualizacao}
                onChange={(event) =>
                  setStatusAtualizacao(
                    event.target.value
                  )
                }
                style={inputStyle}
              >
                <option value="">
                  Não alterar
                </option>

                <option value="ATUALIZADO">
                  Atualizado
                </option>

                <option value="PENDENTE">
                  Pendente
                </option>

                <option value="SEM INFORMAÇÃO">
                  Sem informação
                </option>

                <option value="NÃO SE APLICA">
                  Não se aplica
                </option>
              </select>
            </label>

            <label
              style={{
                ...labelStyle,
                gridColumn: "1 / -1",
              }}
            >
              Observação
              <textarea
                value={observacao}
                onChange={(event) =>
                  setObservacao(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Deixe em branco para não alterar."
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </label>

            <div
              style={{
                gridColumn: "1 / -1",
                padding: "12px",
                backgroundColor:
                  "var(--bg-primary)",
                border:
                  "1px solid var(--border-primary)",
                borderRadius: "8px",
                color:
                  "var(--text-muted)",
                fontSize: "12px",
              }}
            >
              Responsável pela operação:{" "}
              <strong
                style={{
                  color:
                    "var(--text-primary)",
                }}
              >
                {currentUserName}
              </strong>
            </div>
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
                fontWeight: 700,
              }}
            >
              {saving
                ? "Atualizando..."
                : `Atualizar ${selectedCount} selecionado${
                    selectedCount !== 1
                      ? "s"
                      : ""
                  }`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}