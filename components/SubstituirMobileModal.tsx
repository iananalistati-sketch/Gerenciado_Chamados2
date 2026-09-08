import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../auth/api";

interface SubstituirMobileModalProps {
  isOpen: boolean;
  equipment: string[] | null;
  headers: string[];
  allRows: string[][];
  currentUserName: string;
  normalize: (value: string) => string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export default function SubstituirMobileModal({
  isOpen,
  equipment,
  headers,
  allRows,
  currentUserName,
  normalize,
  onClose,
  onSuccess,
}: SubstituirMobileModalProps) {
  const [reserveCollector, setReserveCollector] = useState("");
  const [reason, setReason] = useState("");
  const [observation, setObservation] = useState("");
  const [updateLocation, setUpdateLocation] = useState(true);
  const [destinationSector, setDestinationSector] = useState("");
  const [saving, setSaving] = useState(false);

  const getIndex = (...names: string[]) =>
    headers.findIndex((header) =>
      names.some((name) => normalize(header) === normalize(name))
    );

  const setorIdx = getIndex("Setor");
  const coletorIdx = getIndex("Coletor");
  const snIdx = getIndex("SN");
  const statusIdx = getIndex("Status");
  const setorLocalizadoIdx = getIndex("Setor localizado");

  const originalSector =
    equipment && setorIdx !== -1
      ? String(equipment[setorIdx] || "").trim()
      : "";

  const originalLocation =
    equipment && setorLocalizadoIdx !== -1
      ? String(equipment[setorLocalizadoIdx] || "").trim()
      : "";

  useEffect(() => {
    if (!isOpen || !equipment) {
      return;
    }

    setReserveCollector("");
    setReason("");
    setObservation("");
    setUpdateLocation(true);
    setDestinationSector(originalLocation || originalSector);
  }, [isOpen, equipment, originalLocation, originalSector]);

  const reserves = useMemo(() => {
    if (
      setorIdx === -1 ||
      coletorIdx === -1 ||
      statusIdx === -1
    ) {
      return [];
    }

    return allRows
      .filter((row) => {
        const setor = String(row[setorIdx] || "").trim();
        const status = String(row[statusIdx] || "").trim().toUpperCase();
        const collector = String(row[coletorIdx] || "").trim();
        const currentCollector = equipment
          ? String(equipment[coletorIdx] || "").trim()
          : "";

        return (
          normalize(setor) === normalize("TI-SUPORTE") &&
          status === "A" &&
          collector !== "" &&
          normalize(collector) !== normalize(currentCollector)
        );
      })
      .sort((a, b) =>
        String(a[coletorIdx] || "").localeCompare(
          String(b[coletorIdx] || ""),
          "pt-BR",
          { numeric: true, sensitivity: "base" }
        )
      );
  }, [
    allRows,
    equipment,
    setorIdx,
    coletorIdx,
    statusIdx,
    normalize,
  ]);

  if (!isOpen || !equipment) {
    return null;
  }

  const originalCollector =
    coletorIdx !== -1
      ? String(equipment[coletorIdx] || "").trim()
      : "";
  const originalSn =
    snIdx !== -1
      ? String(equipment[snIdx] || "").trim()
      : "";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!reserveCollector) {
      alert("Selecione o equipamento reserva do TI-SUPORTE.");
      return;
    }

    if (!reason.trim()) {
      alert("Informe o motivo da substituição temporária.");
      return;
    }

    if (updateLocation && !destinationSector.trim()) {
      alert("Informe o setor de localização para onde o equipamento reserva será enviado.");
      return;
    }

    setSaving(true);

    try {
      const response = await apiFetch("/api/mobiles/loan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalCollector,
          reserveCollector,
          responsible: currentUserName,
          reason: reason.trim(),
          observation: observation.trim(),
          updateLocation,
          destinationSector: destinationSector.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Erro ao registrar empréstimo temporário."
        );
      }

      alert(
        `Substituição temporária registrada com sucesso. Empréstimo ${result.loanId}.`
      );

      onClose();
      await onSuccess();
    } catch (error: any) {
      alert(
        "Erro ao registrar substituição temporária: " +
          (error.message || "Erro desconhecido")
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
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
          maxWidth: "660px",
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-primary)",
          borderRadius: "14px",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        <form onSubmit={handleSubmit}>
          <div
            style={{
              padding: "20px 22px",
              borderBottom: "1px solid var(--border-primary)",
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
                  color: "var(--text-primary)",
                  fontSize: "20px",
                }}
              >
                Substituição temporária
              </h2>
              <p
                style={{
                  margin: "5px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                Empreste um equipamento reserva do TI-SUPORTE enquanto o equipamento original estiver em manutenção.
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
                border: "1px solid var(--border-primary)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "18px",
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: "22px", display: "grid", gap: "16px" }}>
            <div
              style={{
                padding: "14px",
                border: "1px solid var(--border-primary)",
                borderRadius: "10px",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-secondary)",
                fontSize: "13px",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "var(--text-primary)" }}>
                Equipamento substituído
              </strong>
              <br />
              Coletor: {originalCollector || "-"} · SN: {originalSn || "-"}
              <br />
              Setor de origem: {originalSector || "-"}
              <br />
              Localização atual: {originalLocation || "-"}
            </div>

            <label style={{ display: "grid", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>
              Equipamento reserva do TI-SUPORTE
              <select
                value={reserveCollector}
                onChange={(event) => setReserveCollector(event.target.value)}
                style={inputStyle}
              >
                <option value="">Selecione um equipamento reserva</option>
                {reserves.map((row) => {
                  const collector = String(row[coletorIdx] || "").trim();
                  const sn = snIdx !== -1 ? String(row[snIdx] || "").trim() : "";
                  const location =
                    setorLocalizadoIdx !== -1
                      ? String(row[setorLocalizadoIdx] || "").trim()
                      : "";

                  return (
                    <option key={`${collector}-${sn}`} value={collector}>
                      {collector}{sn ? ` · SN ${sn}` : ""}{location && normalize(location) !== normalize("TI-SUPORTE") ? ` · Localizado: ${location}` : ""}
                    </option>
                  );
                })}
              </select>
            </label>

            {reserves.length === 0 && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  color: "#F59E0B",
                  fontSize: "12px",
                }}
              >
                Nenhum equipamento ativo do setor TI-SUPORTE está disponível para seleção.
              </div>
            )}

            <div
              style={{
                padding: "14px",
                border: "1px solid var(--border-primary)",
                borderRadius: "10px",
                backgroundColor: "var(--bg-primary)",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={updateLocation}
                  onChange={(event) => setUpdateLocation(event.target.checked)}
                />
                Atualizar setor de localização durante o empréstimo
              </label>

              <p
                style={{
                  margin: "7px 0 12px",
                  color: "var(--text-muted)",
                  fontSize: "11px",
                  lineHeight: 1.5,
                }}
              >
                Quando marcado, o equipamento original será localizado no TI-SUPORTE e a reserva será localizada no setor informado abaixo.
              </p>

              <label style={{ display: "grid", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>
                Setor que receberá o equipamento reserva
                <input
                  type="text"
                  value={destinationSector}
                  onChange={(event) => setDestinationSector(event.target.value)}
                  disabled={!updateLocation}
                  placeholder="Ex.: UTI2"
                  style={{
                    ...inputStyle,
                    opacity: updateLocation ? 1 : 0.6,
                    cursor: updateLocation ? "text" : "not-allowed",
                  }}
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>
              Motivo
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex.: equipamento encaminhado para reparo"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "6px", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>
              Observação
              <textarea
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>
          </div>

          <div
            style={{
              padding: "16px 22px",
              borderTop: "1px solid var(--border-primary)",
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
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-primary)",
                borderRadius: "8px",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving || reserves.length === 0}
              style={{
                padding: "10px 20px",
                backgroundColor: "#F59E0B",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                cursor: saving || reserves.length === 0 ? "not-allowed" : "pointer",
                fontWeight: 700,
                opacity: saving || reserves.length === 0 ? 0.65 : 1,
              }}
            >
              {saving ? "Registrando..." : "Confirmar substituição"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
