import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from "chart.js";

import { Bar, Pie } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export interface DashboardStats {
  statusMap: Record<string, number>;
  gravityMap: Record<string, number>;
  responsibleMap: Record<string, number>;
  criticalCount: number;
  completedCount: number;
}

interface DashboardProps {
  totalFiltered: number;
  stats: DashboardStats;
  onFilter: (
    normalizedHeader: string,
    selectedValue: string
  ) => void;
}

export default function Dashboard({
  totalFiltered,
  stats,
  onFilter
}: DashboardProps) {
  const pendingCount =
    totalFiltered - stats.completedCount;

  return (
    <div
      style={{
        marginBottom: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}
    >
      {/* Indicadores */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px"
        }}
      >
        <div
          style={{
            backgroundColor: "#1E293B",
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid #334155"
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#94A3B8",
              fontWeight: "bold",
              textTransform: "uppercase",
              marginBottom: "8px"
            }}
          >
            Total Filtrado
          </p>

          <h3
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#F8FAFC"
            }}
          >
            {totalFiltered}
          </h3>
        </div>

        <div
          style={{
            backgroundColor: "#1E293B",
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid #334155",
            borderLeft: "4px solid #EF4444"
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#94A3B8",
              fontWeight: "bold",
              textTransform: "uppercase",
              marginBottom: "8px"
            }}
          >
            Críticos / Urgentes
          </p>

          <h3
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#EF4444"
            }}
          >
            {stats.criticalCount}
          </h3>
        </div>

        <div
          style={{
            backgroundColor: "#1E293B",
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid #334155",
            borderLeft: "4px solid #10B981"
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#94A3B8",
              fontWeight: "bold",
              textTransform: "uppercase",
              marginBottom: "8px"
            }}
          >
            Concluídos
          </p>

          <h3
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#10B981"
            }}
          >
            {stats.completedCount}
          </h3>
        </div>

        <div
          style={{
            backgroundColor: "#1E293B",
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid #334155"
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#94A3B8",
              fontWeight: "bold",
              textTransform: "uppercase",
              marginBottom: "8px"
            }}
          >
            Pendentes
          </p>

          <h3
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#3B82F6"
            }}
          >
            {pendingCount}
          </h3>
        </div>
      </div>

      {/* Gráficos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(350px, 1fr))",
          gap: "20px"
        }}
      >
        {/* Situação */}
        <div
          style={{
            backgroundColor: "#1E293B",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #334155"
          }}
        >
          <h4
            style={{
              fontSize: "14px",
              color: "#94A3B8",
              marginBottom: "20px",
              fontWeight: "bold"
            }}
          >
            Distribuição por Situação
          </h4>

          <div
            style={{
              height: "220px",
              display: "flex",
              justifyContent: "center"
            }}
          >
            <Pie
              data={{
                labels: Object.keys(stats.statusMap),
                datasets: [
                  {
                    data: Object.values(stats.statusMap),
                    backgroundColor: [
                      "#10B981",
                      "#3B82F6",
                      "#F59E0B",
                      "#EF4444",
                      "#8B5CF6",
                      "#64748B"
                    ],
                    borderWidth: 0
                  }
                ]
              }}
              options={{
                maintainAspectRatio: false,

                onClick: (_event, elements, chart) => {
                  if (!elements.length) {
                    return;
                  }

                  const clickedIndex =
                    elements[0].index;

                  const selectedValue = String(
                    chart.data.labels?.[
                      clickedIndex
                    ] || ""
                  );

                  if (!selectedValue) {
                    return;
                  }

                  onFilter(
                    "situacao",
                    selectedValue
                  );
                },

                onHover: (event, elements) => {
                  const target =
                    event.native
                      ?.target as HTMLElement | null;

                  if (target) {
                    target.style.cursor =
                      elements.length > 0
                        ? "pointer"
                        : "default";
                  }
                },

                plugins: {
                  legend: {
                    position: "right",
                    labels: {
                      color: "#94A3B8",
                      font: {
                        size: 10
                      }
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Gravidade */}
        <div
          style={{
            backgroundColor: "#1E293B",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #334155"
          }}
        >
          <h4
            style={{
              fontSize: "14px",
              color: "#94A3B8",
              marginBottom: "20px",
              fontWeight: "bold"
            }}
          >
            Distribuição por Gravidade
          </h4>

          <div style={{ height: "220px" }}>
            <Bar
              data={{
                labels: Object.keys(
                  stats.gravityMap
                ),
                datasets: [
                  {
                    label: "Chamados",
                    data: Object.values(
                      stats.gravityMap
                    ),
                    backgroundColor: "#3B82F6",
                    borderRadius: 4
                  }
                ]
              }}
              options={{
                maintainAspectRatio: false,

                onClick: (_event, elements, chart) => {
                  if (!elements.length) {
                    return;
                  }

                  const clickedIndex =
                    elements[0].index;

                  const selectedValue = String(
                    chart.data.labels?.[
                      clickedIndex
                    ] || ""
                  );

                  if (!selectedValue) {
                    return;
                  }

                  onFilter(
                    "gravidade",
                    selectedValue
                  );
                },

                onHover: (event, elements) => {
                  const target =
                    event.native
                      ?.target as HTMLElement | null;

                  if (target) {
                    target.style.cursor =
                      elements.length > 0
                        ? "pointer"
                        : "default";
                  }
                },

                scales: {
                  y: {
                    ticks: {
                      color: "#94A3B8"
                    },
                    grid: {
                      color: "#334155"
                    }
                  },
                  x: {
                    ticks: {
                      color: "#94A3B8"
                    },
                    grid: {
                      display: false
                    }
                  }
                },

                plugins: {
                  legend: {
                    display: false
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Responsável */}
        <div
          style={{
            backgroundColor: "#1E293B",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #334155"
          }}
        >
          <h4
            style={{
              fontSize: "14px",
              color: "#94A3B8",
              marginBottom: "20px",
              fontWeight: "bold"
            }}
          >
            Chamados por Responsável
          </h4>

          <div style={{ height: "220px" }}>
            <Bar
              data={{
                labels: Object.keys(
                  stats.responsibleMap
                ),
                datasets: [
                  {
                    label: "Chamados",
                    data: Object.values(
                      stats.responsibleMap
                    ),
                    backgroundColor: "#8B5CF6",
                    borderRadius: 4
                  }
                ]
              }}
              options={{
                indexAxis: "y",
                maintainAspectRatio: false,

                onClick: (_event, elements, chart) => {
                  if (!elements.length) {
                    return;
                  }

                  const clickedIndex =
                    elements[0].index;

                  const selectedValue = String(
                    chart.data.labels?.[
                      clickedIndex
                    ] || ""
                  );

                  if (!selectedValue) {
                    return;
                  }

                  onFilter(
                    "responsavel",
                    selectedValue
                  );
                },

                onHover: (event, elements) => {
                  const target =
                    event.native
                      ?.target as HTMLElement | null;

                  if (target) {
                    target.style.cursor =
                      elements.length > 0
                        ? "pointer"
                        : "default";
                  }
                },

                scales: {
                  y: {
                    ticks: {
                      color: "#94A3B8"
                    },
                    grid: {
                      display: false
                    }
                  },
                  x: {
                    ticks: {
                      color: "#94A3B8"
                    },
                    grid: {
                      color: "#334155"
                    }
                  }
                },

                plugins: {
                  legend: {
                    display: false
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}