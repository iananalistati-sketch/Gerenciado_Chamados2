import { useEffect } from "react";
import { isTrainingBase } from "../auth/dataBase";

// Identificação exibida somente na base de treinamento (produção não mostra nada).
export default function TrainingBanner() {
  const training = isTrainingBase();

  useEffect(() => {
    if (!training) return;
    const original = document.title;
    document.title = `[TREINAMENTO] ${original.replace(/^\[TREINAMENTO\]\s*/, "")}`;
    return () => {
      document.title = original;
    };
  }, [training]);

  if (!training) return null;

  return (
    <div
      className="training-banner"
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 900,
        padding: "12px 20px",
        background: "repeating-linear-gradient(135deg, #F59E0B, #F59E0B 18px, #D97706 18px, #D97706 36px)",
        color: "#111827",
        textAlign: "center",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
      }}
    >
      <strong style={{ display: "block", fontSize: "18px", letterSpacing: "0.08em" }}>BASE DE TREINAMENTO</strong>
      <span style={{ fontSize: "12px", fontWeight: 600 }}>
        Você está usando a base de treinamento. As informações registradas aqui não afetam a base de produção.
      </span>
    </div>
  );
}
