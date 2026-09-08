import React, { useEffect, useMemo, useState } from "react";
import SubstituirMobileModal from "./SubstituirMobileModal";

interface EditarMobileModalProps {
  isOpen: boolean;
  row: string[] | null;
  headers: string[];
  allRows: string[][];
  mobileConfig: string[][];
  mobileApps: string[][];
  currentUserName: string;
  normalize: (value: string) => string;
  onClose: () => void;
  onSave: (rowData: string[], rowIndex: number) => Promise<void>;
  onSaveMobileApp: (rowData: string[], rowIndex: number) => Promise<void>;
  onRefresh: () => void | Promise<void>;
}

export default function EditarMobileModal({
  isOpen,
  row,
  headers,
  allRows,
  mobileConfig,
  mobileApps,
  currentUserName,
  normalize,
  onClose,
  onSave,
  onSaveMobileApp,
  onRefresh,
}: EditarMobileModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [returning, setReturning] = useState(false);
  const [showSubstitute, setShowSubstitute] = useState(false);

  const getHeader = (...names: string[]) =>
    headers.find((header) =>
      names.some((name) => normalize(header) === normalize(name))
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
  const setorLocalizadoHeader = getHeader("Setor localizado");
  const versaoHeader = getHeader("Versão", "Versao");
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

  const getToday = () => {
    const now = new Date();
    const localDate = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    );
    return localDate.toISOString().split("T")[0];
  };

  const setores = useMemo(() => {
    if (!setorHeader) return [];
    const index = headers.indexOf(setorHeader);
    if (index === -1) return [];

    return Array.from(
      new Set(
        allRows
          .map((item) => String(item[index] || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, "pt-BR", {
        sensitivity: "base",
        numeric: true,
      })
    );
  }, [allRows, headers, setorHeader]);

  const { appOptions, targetVersions } = useMemo(() => {
    const apps: string[] = [];
    const targets: Record<string, string> = {};
    const configHeaders = mobileConfig[0] || [];
    const appIdx = configHeaders.findIndex(
      (header) => normalize(header) === normalize("APP_USO")
    );
    const targetIdx = configHeaders.findIndex(
      (header) => normalize(header) === normalize("VERSAO_ALVO")
    );

    if (appIdx !== -1) {
      mobileConfig.slice(1).forEach((item) => {
        const app = String(item[appIdx] || "").trim();
        if (!app || normalize(app) === "todos") return;
        if (!apps.some((known) => normalize(known) === normalize(app))) {
          apps.push(app);
        }
        if (targetIdx !== -1) {
          const target = String(item[targetIdx] || "").trim();
          if (target) targets[normalize(app)] = target;
        }
      });
    }

    apps.sort((a, b) =>
      a.localeCompare(b, "pt-BR", {
        sensitivity: "base",
        numeric: true,
      })
    );

    return {
      appOptions: ["TODOS", ...apps],
      targetVersions: targets,
    };
  }, [mobileConfig, normalize]);

  const calculateUpdateStatus = (app: string, version: string) => {
    const normalizedApp = normalize(app);
    const currentVersion = String(version || "").trim();

    if (
      !app ||
      normalizedApp === "todos" ||
      !currentVersion ||
      !targetVersions[normalizedApp]
    ) {
      return "SEM INFORMAÇÃO";
    }

    return currentVersion === targetVersions[normalizedApp]
      ? "ATUALIZADO"
      : "PENDENTE";
  };

  useEffect(() => {
    if (!isOpen || !row) return;

    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      values[header] = row[index] || "";
    });

    if (statusAtualizacaoHeader && appHeader && versaoHeader) {
      values[statusAtualizacaoHeader] = calculateUpdateStatus(
        values[appHeader] || "",
        values[versaoHeader] || ""
      );
    }

    setFormData(values);
    setShowSubstitute(false);
  }, [isOpen, row, headers]);

  if (!isOpen || !row) return null;

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

  const isOperationalStatus = currentStatus === "M" || currentStatus === "E";

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "A": return "Ativo";
      case "I": return "Inativo";
      case "M": return "Manutenção";
      case "E": return "Emprestado";
      default: return status || "Não informado";
    }
  };

  const handleChange = (header: string | undefined, value: string) => {
    if (!header) return;

    setFormData((previous) => {
      const next = { ...previous, [header]: value };

      if (header === appHeader && versaoHeader) {
        if (normalize(value) === "todos") {
          next[versaoHeader] = "";
        } else if (
          normalize(previous[appHeader || ""] || "") !== normalize(value)
        ) {
          next[versaoHeader] = "";
        }
      }

      if (
        statusAtualizacaoHeader &&
        (header === appHeader || header === versaoHeader)
      ) {
        next[statusAtualizacaoHeader] = calculateUpdateStatus(
          appHeader ? next[appHeader] || "" : "",
          versaoHeader ? next[versaoHeader] || "" : ""
        );
      }

      return next;
    });
  };

  const handleFinalizeLoan = async () => {
    if (!canFinalizeLoan || !currentCollector) return;

    const confirmed = window.confirm(
      `Finalizar o empréstimo do equipamento reserva "${currentCollector}"?\n\nO equipamento original voltará para Ativo e a reserva ficará disponível novamente.`
    );
    if (!confirmed) return;

    const updateLocation = window.confirm(
      "Deseja atualizar o setor de localização na devolução?\n\nSe confirmar, a reserva retornará para TI-SUPORTE e você poderá informar o setor onde o equipamento original será devolvido."
    );

    let returnSector = "";
    if (updateLocation) {
      const informedSector = window.prompt(
        "Informe o setor de localização para devolução do equipamento original:",
        currentLocation || currentSector || ""
      );
      if (informedSector === null) return;
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
    if (observation === null) return;

    setReturning(true);
    try {
      const response = await fetch("/api/mobiles/loan-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserveCollector: currentCollector,
          responsible: currentUserName,
          observation: observation.trim(),
          updateLocation,
          returnSector,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error || "Erro ao finalizar empréstimo temporário."
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

  const requireValue = (header: string | undefined, label: string) => {
    if (!header || !String(formData[header] || "").trim()) {
      alert(`Informe ${label}.`);
      return false;
    }
    return true;
  };

  const syncSingleApp = async (
    originalApp: string,
    newApp: string,
    newVersion: string,
    versionChanged: boolean
  ) => {
    if (!coletorHeader) return;
    if (normalize(originalApp) === "todos" || normalize(newApp) === "todos") {
      return;
    }

    const childHeaders = mobileApps[0] || [];
    const findChildIndex = (name: string) =>
      childHeaders.findIndex(
        (header) => normalize(header) === normalize(name)
      );

    const childCollectorIdx = findChildIndex("COLETOR");
    const childAppIdx = findChildIndex("APP_USO");
    const childVersionIdx = findChildIndex("VERSAO");
    const childDateIdx = findChildIndex("DATA_ATUALIZACAO");
    const childStatusIdx = findChildIndex("STATUS_ATUALIZACAO");
    const childResponsibleIdx = findChildIndex("RESPONSAVEL_ATUALIZACAO");
    const childCounterIdx = findChildIndex("CONTADOR_ATUALIZACAO");

    if (childCollectorIdx === -1 || childAppIdx === -1) return;

    const originalCollectorIdx = headers.indexOf(coletorHeader);
    const originalCollector = String(row[originalCollectorIdx] || "").trim();

    const childRow = mobileApps.slice(1).find((item) =>
      normalize(item[childCollectorIdx] || "") === normalize(originalCollector) &&
      normalize(item[childAppIdx] || "") === normalize(originalApp)
    );

    if (!childRow) return;

    const rowIndex = (childRow as any)._originalIndex;
    if (typeof rowIndex !== "number") return;

    const updatedChild = [...childRow];
    updatedChild[childAppIdx] = newApp;

    if (childVersionIdx !== -1) {
      updatedChild[childVersionIdx] = newVersion;
    }
    if (childStatusIdx !== -1) {
      updatedChild[childStatusIdx] = calculateUpdateStatus(newApp, newVersion);
    }

    if (versionChanged) {
      if (childDateIdx !== -1) updatedChild[childDateIdx] = getToday();
      if (childResponsibleIdx !== -1) {
        updatedChild[childResponsibleIdx] = currentUserName;
      }
      if (childCounterIdx !== -1) {
        const originalCounter =
          Number(String(childRow[childCounterIdx] || "0").replace(",", ".")) || 0;
        updatedChild[childCounterIdx] = String(originalCounter + 1);
      }
    }

    await onSaveMobileApp(updatedChild, rowIndex);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (
      !setorHeader ||
      !setorLocalizadoHeader ||
      !coletorHeader ||
      !snHeader ||
      !finalHeader ||
      !macHeader ||
      !appHeader ||
      !statusHeader
    ) {
      alert("A estrutura de colunas do controle de mobiles está incompleta.");
      return;
    }

    if (!requireValue(setorHeader, "o Setor")) return;
    if (!requireValue(setorLocalizadoHeader, "o Setor localizado")) return;
    if (!requireValue(coletorHeader, "o Coletor")) return;
    if (!requireValue(snHeader, "o SN")) return;
    if (!requireValue(finalHeader, "o FINAL")) return;
    if (!requireValue(macHeader, "o MAC")) return;
    if (!requireValue(appHeader, "o App de uso")) return;
    if (!requireValue(statusHeader, "o Status")) return;

    const currentRowIndex = (row as any)._originalIndex;
    if (typeof currentRowIndex !== "number") {
      alert("Não foi possível identificar a linha original do equipamento.");
      return;
    }

    const sn = String(formData[snHeader] || "").trim();
    const final = String(formData[finalHeader] || "").trim();
    const app = String(formData[appHeader] || "").trim();
    const version = versaoHeader
      ? String(formData[versaoHeader] || "").trim()
      : "";

    if (!/^\d+$/.test(sn)) {
      alert("O SN deve conter apenas números.");
      return;
    }
    if (!/^\d+$/.test(final)) {
      alert("O FINAL deve conter apenas números.");
      return;
    }
    if (normalize(app) !== "todos" && !version) {
      alert("Informe a Versão para equipamentos que utilizam um App específico.");
      return;
    }

    const originalApp = String(
      row[headers.indexOf(appHeader)] || ""
    ).trim();
    const originalVersion = versaoHeader
      ? String(row[headers.indexOf(versaoHeader)] || "").trim()
      : "";

    if (
      normalize(originalApp) !== normalize(app) &&
      (normalize(originalApp) === "todos" || normalize(app) === "todos")
    ) {
      alert(
        "A alteração entre TODOS e um App específico exige reorganizar os registros individuais de aplicativos. Por segurança, faça esse ajuste em uma etapa específica da gestão de Apps."
      );
      return;
    }

    const status = String(formData[statusHeader] || "")
      .trim()
      .toUpperCase();
    const originalStatus = String(
      row[headers.indexOf(statusHeader)] || ""
    ).trim().toUpperCase();

    if (
      (status === "M" || status === "E") &&
      status !== originalStatus
    ) {
      alert(
        "Os status Manutenção e Emprestado são controlados automaticamente pela rotina de empréstimo e não podem ser definidos manualmente."
      );
      return;
    }

    if (!isOperationalStatus && !["A", "I"].includes(status)) {
      alert("Informe um Status válido: Ativo ou Inativo.");
      return;
    }

    const snIdx = headers.indexOf(snHeader);
    const coletorIdx = headers.indexOf(coletorHeader);
    const statusIdx = headers.indexOf(statusHeader);
    const coletor = String(formData[coletorHeader] || "").trim();

    const duplicateSn = allRows.some((otherRow) => {
      const otherRowIndex = (otherRow as any)._originalIndex;
      if (otherRowIndex === currentRowIndex) return false;
      const otherSn = String(otherRow[snIdx] || "").trim();
      return otherSn && normalize(otherSn) === normalize(sn);
    });

    if (duplicateSn) {
      alert(`Já existe outro equipamento cadastrado com o SN "${sn}".`);
      return;
    }

    if (status === "A") {
      const activeCollectorExists = allRows.some((otherRow) => {
        const otherRowIndex = (otherRow as any)._originalIndex;
        if (otherRowIndex === currentRowIndex) return false;
        return (
          normalize(otherRow[coletorIdx] || "") === normalize(coletor) &&
          String(otherRow[statusIdx] || "").trim().toUpperCase() === "A"
        );
      });
      if (activeCollectorExists) {
        alert(
          `Já existe outro equipamento ATIVO utilizando o Coletor "${coletor}".`
        );
        return;
      }
    }

    const updatedData = { ...formData };
    const versionChanged = originalVersion !== version;
    const appChanged = normalize(originalApp) !== normalize(app);

    if (statusAtualizacaoHeader) {
      updatedData[statusAtualizacaoHeader] = calculateUpdateStatus(app, version);
    }

    if (versionChanged || appChanged) {
      if (dataAtualizacaoHeader) {
        updatedData[dataAtualizacaoHeader] = getToday();
      }
      if (responsavelAtualizacaoHeader) {
        updatedData[responsavelAtualizacaoHeader] = currentUserName;
      }
      if (contadorHeader) {
        const originalCounter =
          Number(
            String(row[headers.indexOf(contadorHeader)] || "0")
              .replace(",", ".")
          ) || 0;
        updatedData[contadorHeader] = String(originalCounter + 1);
      }
    }

    const updatedRow = headers.map(
      (header) => updatedData[header] || ""
    );

    setSaving(true);
    try {
      await onSave(updatedRow, currentRowIndex);
      if (normalize(app) !== "todos" && (versionChanged || appChanged)) {
        await syncSingleApp(
          originalApp,
          app,
          version,
          versionChanged || appChanged
        );
      }
      await Promise.resolve(onRefresh());
      onClose();
    } catch (error: any) {
      alert(
        "Erro ao salvar equipamento: " +
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

  const labelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: 600,
  };

  const renderField = (
    header: string | undefined,
    label: string,
    options?: {
      type?: "text" | "date" | "select" | "textarea";
      required?: boolean;
      readOnly?: boolean;
      choices?: Array<{ value: string; label: string }>;
      numericOnly?: boolean;
      disabled?: boolean;
      helper?: string;
    }
  ) => {
    if (!header) return null;

    const type = options?.type || "text";
    const required = Boolean(options?.required);
    const readOnly = Boolean(options?.readOnly);
    const disabled = Boolean(options?.disabled);

    return (
      <label style={labelStyle}>
        {label}{required ? " *" : ""}
        {type === "select" ? (
          <select
            value={formData[header] || ""}
            required={required}
            disabled={disabled}
            onChange={(event) => handleChange(header, event.target.value)}
            style={{ ...inputStyle, opacity: disabled ? 0.65 : 1 }}
          >
            <option value="">Selecione</option>
            {(options?.choices || []).map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        ) : type === "textarea" ? (
          <textarea
            value={formData[header] || ""}
            rows={3}
            onChange={(event) => handleChange(header, event.target.value)}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        ) : (
          <input
            type={type}
            value={formData[header] || ""}
            required={required}
            readOnly={readOnly}
            disabled={disabled}
            inputMode={options?.numericOnly ? "numeric" : undefined}
            onChange={(event) =>
              handleChange(
                header,
                options?.numericOnly
                  ? event.target.value.replace(/\D/g, "")
                  : event.target.value
              )
            }
            style={{
              ...inputStyle,
              cursor: readOnly || disabled ? "not-allowed" : undefined,
              opacity: readOnly || disabled ? 0.7 : 1,
            }}
          />
        )}
        {options?.helper && (
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: "10px",
              fontWeight: 500,
            }}
          >
            {options.helper}
          </span>
        )}
      </label>
    );
  };

  const appValue = appHeader ? formData[appHeader] || "" : "";
  const isTodos = normalize(appValue) === "todos";

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
        zIndex: 1100,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          maxHeight: "90vh",
          overflowY: "auto",
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
                Editar Equipamento
              </h2>
              <p
                style={{
                  margin: "5px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                {currentCollector || "Equipamento"} · campos com * são obrigatórios.
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
                border: "1px solid var(--border-primary)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                cursor: saving || returning ? "not-allowed" : "pointer",
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
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "18px",
            }}
          >
            {renderField(setorHeader, "Setor", {
              type: "select",
              required: true,
              choices: setores.map((item) => ({ value: item, label: item })),
            })}
            {renderField(setorLocalizadoHeader, "Setor localizado", {
              type: "select",
              required: true,
              choices: setores.map((item) => ({ value: item, label: item })),
            })}
            {renderField(coletorHeader, "Coletor", { required: true })}
            {renderField(snHeader, "SN", {
              required: true,
              numericOnly: true,
            })}
            {renderField(finalHeader, "FINAL", {
              required: true,
              numericOnly: true,
            })}
            {renderField(macHeader, "MAC", { required: true })}
            {renderField(ipHeader, "IP")}
            {renderField(appHeader, "App de uso", {
              type: "select",
              required: true,
              disabled: isOperationalStatus,
              choices: appOptions.map((item) => ({ value: item, label: item })),
              helper: isOperationalStatus
                ? "Não altere o App enquanto o equipamento estiver em empréstimo/manutenção."
                : undefined,
            })}
            {renderField(entregueHeader, "Entregue", { type: "date" })}
            {renderField(versaoHeader, "Versão", {
              required: Boolean(appValue) && !isTodos,
              disabled: isTodos || isOperationalStatus,
              helper: isTodos
                ? "Para TODOS, as versões são controladas individualmente na opção Apps."
                : "Ao alterar a versão, data, contador e responsável são atualizados automaticamente.",
            })}

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
                renderField(statusHeader, "Status", {
                  type: "select",
                  required: true,
                  choices: [
                    { value: "A", label: "Ativo" },
                    { value: "I", label: "Inativo" },
                  ],
                })
              )
            )}

            {renderField(statusAtualizacaoHeader, "Status atualização", {
              readOnly: true,
              helper: "Calculado automaticamente pela versão atual e versão de referência.",
            })}
            {renderField(dataAtualizacaoHeader, "Data atualização", {
              type: "date",
              readOnly: true,
            })}
            {renderField(contadorHeader, "Contador atualização", {
              readOnly: true,
            })}
            {renderField(
              responsavelAtualizacaoHeader,
              "Responsável atualização",
              { readOnly: true }
            )}
            {obsHeader && (
              <div style={{ gridColumn: "1 / -1" }}>
                {renderField(obsHeader, "Observação", { type: "textarea" })}
              </div>
            )}
          </div>

          <div
            style={{
              padding: "16px 22px",
              borderTop: "1px solid var(--border-primary)",
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
                  {returning ? "Finalizando..." : "Finalizar empréstimo"}
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
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "8px",
                  cursor: saving || returning ? "not-allowed" : "pointer",
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
                  cursor: saving || returning ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
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
