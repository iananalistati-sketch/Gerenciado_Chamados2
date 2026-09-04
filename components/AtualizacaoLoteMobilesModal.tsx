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

export default function AtualizacaoLoteMobilesModal({
  isOpen,
  selectedCount,
  currentUserName,
  onClose,
  onApply,
}: AtualizacaoLoteMobilesModalProps) {
  const [appUso, setAppUso] =
    useState("");
  const [versao, setVersao] =
    useState("");
  const [observacao, setObservacao] =
    useState("");
  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAppUso("");
    setVersao("");
    setObservacao("");
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!appUso) {
      alert(
        "Selecione o aplicativo que será atualizado."
      );
      return;
    }

    if (!versao.trim()) {
      alert(
        "Informe a nova versão do aplicativo."
      );
      return;
    }

    setSaving(true);

    try {
      await onApply({
        versao: versao.trim(),
        dataAtualizacao: getToday(),
        status: currentUserName,
        statusAtualizacao: appUso,
        observacao: observacao.trim(),
      });

      onClose();

      /*
       * A atualização em lote grava os dados na tbMobileApps.
       * O estado dessa aba é carregado separadamente do cadastro
       * físico em tbControleMobiles. Recarregamos a aplicação após
       * a conclusão para garantir que o modal "Apps" reflita
       * imediatamente os valores persistidos no Google Sheets.
       *
       * Esta recarga pode ser substituída futuramente por um refresh
       * específico da tbMobileApps no App.tsx.
       */
      window.location.reload();
    } catch (error: any) {
      alert(
        "Erro ao atualizar aplicativos: " +
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
    border:
      "1px solid var(--border-primary)",
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
              justifyContent:
                "space-between",
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
                Atualização de Apps em Lote
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color:
                    "var(--text-muted)",
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
              Aplicativo
              <select
                value={appUso}
                onChange={(event) =>
                  setAppUso(
                    event.target.value
                  )
                }
                style={inputStyle}
                required
              >
                <option value="">
                  Selecione o aplicativo
                </option>
                <option value="ASSISTENCIAL">
                  ASSISTENCIAL
                </option>
                <option value="FARMACIA">
                  FARMACIA
                </option>
                <option value="HIGIENIZACAO">
                  HIGIENIZACAO
                </option>
              </select>
            </label>

            <label style={labelStyle}>
              Nova versão
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
                required
              />
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
                placeholder="Ex.: Atualização setembro/2026"
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
                lineHeight: 1.6,
              }}
            >
              <div>
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
              <div>
                Data da atualização:{" "}
                <strong
                  style={{
                    color:
                      "var(--text-primary)",
                  }}
                >
                  {getToday()}
                </strong>
              </div>
              <div
                style={{
                  marginTop: "8px",
                }}
              >
                Somente os equipamentos que
                possuírem o aplicativo
                selecionado serão atualizados.
                Equipamentos sem esse App serão
                ignorados e contabilizados no
                resultado.
              </div>
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
                backgroundColor:
                  "#3B82F6",
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
