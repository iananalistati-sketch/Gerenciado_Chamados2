import React from "react";

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

export default function ControleMobiles({
  data,
  loading,
  error,
  onRefresh,
}: ControleMobilesProps) {
  const headers = data[0] || [];
  const rows = data.slice(1);

  const statusIdx = headers.findIndex(
    (header) => normalize(header) === "status"
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

  const cards = [
    {
      label: "Total de Equipamentos",
      value: totalEquipamentos,
    },
    {
      label: "Ativos",
      value: totalAtivos,
    },
    {
      label: "Manutenção",
      value: totalManutencao,
    },
    {
      label: "Inativos",
      value: totalInativos,
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
          </div>
        ))}
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
            backgroundColor: "rgba(220, 38, 38, 0.12)",
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
          Nenhum equipamento encontrado na aba tbControleMobiles.
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
              borderBottom: "1px solid var(--border-primary)",
            }}
          >
            <strong style={{ color: "var(--text-primary)" }}>
              Equipamentos cadastrados
            </strong>

            <span
              style={{
                marginLeft: "10px",
                color: "var(--text-muted)",
                fontSize: "12px",
              }}
            >
              {totalEquipamentos} registros
            </span>
          </div>

          <div
            style={{
              padding: "20px",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            A tabela operacional será adicionada na próxima etapa.
          </div>
        </div>
      )}
    </div>
  );
}