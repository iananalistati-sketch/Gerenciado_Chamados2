interface ConcluirModalProps {
  isOpen: boolean;
  conclusionDate: string;
  onDateChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConcluirModal({
  isOpen,
  conclusionDate,
  onDateChange,
  onClose,
  onConfirm
}: ConcluirModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(2, 6, 23, 0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1100,
        padding: "20px",
        backdropFilter: "blur(8px)",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "#1E293B",
          border: "1px solid #334155",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          boxSizing: "border-box"
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: "12px",
            fontSize: "22px",
            color: "#F8FAFC"
          }}
        >
          Concluir chamado
        </h2>

        <p
          style={{
            marginTop: 0,
            marginBottom: "22px",
            color: "#94A3B8",
            fontSize: "14px",
            lineHeight: "1.5"
          }}
        >
          Confirme a Data da Última Interação que será utilizada como data de
          conclusão do chamado.
        </p>

        <label
          style={{
            display: "block",
            marginBottom: "8px",
            color: "#CBD5E1",
            fontSize: "13px",
            fontWeight: "600"
          }}
        >
          Data da Última Interação
        </label>

        <input
          type="date"
          value={conclusionDate}
          onChange={(event) => onDateChange(event.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#0F172A",
            color: "#F8FAFC",
            border: "1px solid #334155",
            borderRadius: "8px",
            outline: "none",
            fontSize: "14px",
            boxSizing: "border-box",
            marginBottom: "24px"
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px"
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "11px 18px",
              backgroundColor: "transparent",
              color: "#94A3B8",
              border: "1px solid #334155",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "11px 18px",
              backgroundColor: "#10B981",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "700"
            }}
            onMouseOver={(event) => {
              event.currentTarget.style.backgroundColor = "#059669";
            }}
            onMouseOut={(event) => {
              event.currentTarget.style.backgroundColor = "#10B981";
            }}
          >
            Confirmar conclusão
          </button>
        </div>
      </div>
    </div>
  );
}