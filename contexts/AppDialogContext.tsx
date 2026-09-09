import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type DialogVariant = "info" | "success" | "warning" | "error";

interface DialogOptions {
  title?: string;
  variant?: DialogVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
}

interface DialogRequest extends DialogOptions {
  kind: "alert" | "confirm" | "prompt";
  message: string;
  resolve: (value: boolean | string | null) => void;
}

interface AppDialogApi {
  alert: (message: string, options?: DialogOptions) => Promise<void>;
  confirm: (message: string, options?: DialogOptions) => Promise<boolean>;
  prompt: (message: string, options?: DialogOptions) => Promise<string | null>;
}

const AppDialogContext = createContext<AppDialogApi | null>(null);

const variants: Record<DialogVariant, { icon: string; title: string }> = {
  info: { icon: "i", title: "Informação" },
  success: { icon: "✓", title: "Tudo certo" },
  warning: { icon: "!", title: "Atenção" },
  error: { icon: "×", title: "Não foi possível concluir" },
};

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [inputValue, setInputValue] = useState("");

  const open = useCallback((kind: DialogRequest["kind"], message: string, options: DialogOptions = {}) =>
    new Promise<boolean | string | null>((resolve) => {
      setInputValue(options.defaultValue || "");
      setRequest({ kind, message, ...options, resolve });
    }), []);

  const alert = useCallback(async (message: string, options?: DialogOptions) => {
    await open("alert", message, options);
  }, [open]);

  const confirm = useCallback(async (message: string, options?: DialogOptions) =>
    Boolean(await open("confirm", message, options)), [open]);

  const prompt = useCallback(async (message: string, options?: DialogOptions) => {
    const result = await open("prompt", message, options);
    return typeof result === "string" ? result : null;
  }, [open]);

  const close = useCallback((value: boolean | string | null) => {
    setRequest((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!request) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(request.kind === "alert" ? true : null);
      if (event.key === "Enter" && request.kind !== "prompt") close(true);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [request, close]);

  const api = useMemo(() => ({ alert, confirm, prompt }), [alert, confirm, prompt]);
  const variant = request?.variant || "info";
  const appearance = variants[variant];

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      {request && (
        <div className="app-dialog-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && request.kind !== "alert") close(null);
        }}>
          <section className={`app-dialog-card app-dialog-${variant}`} role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message">
            <div className={`app-dialog-icon app-dialog-icon-${variant}`} aria-hidden="true">{appearance.icon}</div>
            <div className="app-dialog-content">
              <h2 id="app-dialog-title">{request.title || appearance.title}</h2>
              <p id="app-dialog-message">{request.message}</p>
              {request.kind === "prompt" && (request.multiline ? (
                <textarea autoFocus value={inputValue} placeholder={request.placeholder} onChange={(event) => setInputValue(event.target.value)} rows={4} />
              ) : (
                <input autoFocus type="text" value={inputValue} placeholder={request.placeholder} onChange={(event) => setInputValue(event.target.value)} onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    close(inputValue);
                  }
                }} />
              ))}
            </div>
            <div className="app-dialog-actions">
              {request.kind !== "alert" && (
                <button type="button" className="app-dialog-button app-dialog-button-secondary" onClick={() => close(null)}>
                  {request.cancelLabel || "Cancelar"}
                </button>
              )}
              <button type="button" autoFocus={request.kind !== "prompt"} className={`app-dialog-button app-dialog-button-primary app-dialog-button-${variant}`} onClick={() => close(request.kind === "prompt" ? inputValue : true)}>
                {request.confirmLabel || (request.kind === "alert" ? "Entendi" : "Confirmar")}
              </button>
            </div>
          </section>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);
  if (!context) throw new Error("useAppDialog deve ser usado dentro de AppDialogProvider.");
  return context;
}
