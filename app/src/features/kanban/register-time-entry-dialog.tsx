import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyCapabilities } from "@/features/companies/capabilities-contracts";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { useRegisterTimeEntry } from "@/features/tasks/time-entry-mutations";
import { ApiError } from "@/lib/http/api-error";
import "./register-time-entry-dialog.css";

const MIN_DURATION = 1;
const MAX_DURATION = 1440;
const MAX_DESCRIPTION = 1000;

export function canRegisterTimeEntry(
  task: Pick<TaskCard, "assigneeId"> | null,
  capabilities: CompanyCapabilities | undefined,
  companyId: string,
  userId: string | undefined,
  isAuthenticated: boolean,
): boolean {
  if (
    !task ||
    !isAuthenticated ||
    !userId ||
    !capabilities ||
    capabilities.companyId !== companyId ||
    capabilities.capabilities["hours.register"] !== true
  ) {
    return false;
  }
  return task.assigneeId === userId || capabilities.capabilities["kanban.manage"] === true;
}

interface RegisterTimeEntryDialogProps {
  companyId: string;
  task: TaskCard;
  isOpen: boolean;
  canRegister: boolean;
  onCapabilitiesForbidden?: () => void;
}

export function RegisterTimeEntryDialog({ canRegister, ...props }: RegisterTimeEntryDialogProps) {
  if (!canRegister) return null;
  return <RegisterTimeEntryForm {...props} />;
}

function RegisterTimeEntryForm({
  companyId,
  task,
  isOpen,
  onCapabilitiesForbidden,
}: Omit<RegisterTimeEntryDialogProps, "canRegister">) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const visualViewport = useVisualViewport(dialogOpen);
  const taskContext = `${companyId}:${task.id}`;
  const previousTaskContext = useRef(taskContext);
  const registerTimeEntry = useRegisterTimeEntry(companyId, task.id, {
    onSuccess: () => {
      if (!isOpen || !dialogRef.current) return;
      setDuration("");
      setDescription("");
      setValidationError(null);
      close();
      registerTimeEntry.reset();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) onCapabilitiesForbidden?.();
    },
  });

  const close = useCallback(
    (restoreFocus = true) => {
      registerTimeEntry.abort();
      setDialogOpen(false);
      if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
    },
    [registerTimeEntry.abort],
  );

  useEffect(() => {
    if (!isOpen) close(false);
  }, [close, isOpen]);

  useEffect(() => {
    if (previousTaskContext.current === taskContext) return;
    previousTaskContext.current = taskContext;
    close(false);
  }, [close, taskContext]);

  useEffect(() => {
    return () => registerTimeEntry.abort();
  }, [registerTimeEntry.abort]);

  function open(): void {
    setValidationError(null);
    registerTimeEntry.clearError();
    setDialogOpen(true);
    window.setTimeout(() => durationRef.current?.focus(), 0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function validate(): number | null {
    const parsed = Number(duration);
    if (!duration.trim()) {
      setValidationError("Informe a duração em minutos.");
      return null;
    }
    if (!Number.isInteger(parsed)) {
      setValidationError("Informe um número inteiro de minutos.");
      return null;
    }
    if (parsed < MIN_DURATION) {
      setValidationError("A duração mínima é de 1 minuto.");
      return null;
    }
    if (parsed > MAX_DURATION) {
      setValidationError("A duração máxima é de 1440 minutos.");
      return null;
    }
    if (description.length > MAX_DESCRIPTION) {
      setValidationError("A descrição deve ter no máximo 1000 caracteres.");
      return null;
    }
    return parsed;
  }

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const durationMinutes = validate();
    if (durationMinutes === null) {
      durationRef.current?.focus();
      return;
    }
    setValidationError(null);
    registerTimeEntry.register({
      durationMinutes,
      ...(description.trim() ? { description: description.trim() } : {}),
    });
  }

  const error = validationError ?? registerTimeEntry.error?.message ?? null;
  const errorId = `register-time-entry-error-${task.id}`;
  const dialog = dialogOpen ? (
    <div
      className="register-time-entry-backdrop"
      data-testid="register-time-entry-backdrop"
      style={{
        position: "fixed",
        left: visualViewport.left,
        top: visualViewport.top,
        right: "auto",
        bottom: "auto",
        boxSizing: "border-box",
        width: visualViewport.width,
        height: visualViewport.height,
        padding: 8,
        overflow: "hidden",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`register-time-entry-title-${task.id}`}
        className="register-time-entry-modal"
        style={{
          boxSizing: "border-box",
          minWidth: 0,
          maxWidth: "32rem",
          minHeight: 0,
          maxHeight: "calc(100dvh - 16px)",
          overflow: "hidden",
        }}
        onKeyDown={handleKeyDown}
      >
        <header className="register-time-entry-header">
          <div>
            <h2 id={`register-time-entry-title-${task.id}`} className="text-lg font-semibold">
              Registrar horas
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Registre minutos trabalhados manualmente nesta tarefa.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => close()}>
            Fechar
          </Button>
        </header>
        <form className="contents" onSubmit={submit} noValidate>
          <main className="register-time-entry-main">
            <div className="grid gap-2">
              <Label htmlFor={`register-time-entry-duration-${task.id}`}>Duração (minutos)</Label>
              <Input
                ref={durationRef}
                id={`register-time-entry-duration-${task.id}`}
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                step="1"
                inputMode="numeric"
                required
                value={duration}
                disabled={registerTimeEntry.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                  setDuration(event.target.value);
                  setValidationError(null);
                  registerTimeEntry.clearError();
                }}
              />
            </div>
            <div className="mt-4 grid gap-2">
              <Label htmlFor={`register-time-entry-description-${task.id}`}>
                Descrição (opcional)
              </Label>
              <textarea
                id={`register-time-entry-description-${task.id}`}
                className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                maxLength={MAX_DESCRIPTION}
                value={description}
                disabled={registerTimeEntry.isPending}
                aria-invalid={Boolean(error && description.length > MAX_DESCRIPTION)}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setValidationError(null);
                  registerTimeEntry.clearError();
                }}
              />
              <p className="text-right text-xs text-muted-foreground">
                {description.length}/{MAX_DESCRIPTION}
              </p>
            </div>
            {error && (
              <p id={errorId} className="mt-3 text-sm text-destructive" role="alert">
                {validationError ??
                  (registerTimeEntry.error
                    ? messageForRegisterTimeEntryError(registerTimeEntry.error)
                    : error)}
              </p>
            )}
          </main>
          <footer className="register-time-entry-footer">
            <Button
              type="button"
              variant="outline"
              onClick={() => close()}
              disabled={registerTimeEntry.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={registerTimeEntry.isPending}
              aria-busy={registerTimeEntry.isPending}
            >
              {registerTimeEntry.isPending ? "Registrando..." : "Registrar horas"}
            </Button>
          </footer>
          {registerTimeEntry.isPending && (
            <p className="sr-only" role="status">
              Registrando horas...
            </p>
          )}
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        variant="outline"
        onClick={open}
        aria-label={`Registrar horas na tarefa ${task.title}`}
      >
        Registrar horas
      </Button>
      {createPortal(dialog, document.body)}
    </>
  );
}

export function messageForRegisterTimeEntryError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || "Revise os dados do apontamento.";
    if (error.status === 401) return "Sua sessão expirou. Entre novamente para registrar horas.";
    if (error.status === 403) return "Você não tem permissão para registrar horas nesta tarefa.";
    if (error.status === 404) return "A tarefa não foi encontrada ou não está acessível.";
    if (error.status === 422)
      return error.message || "O apontamento não foi aceito pela regra de negócio.";
    if (error.status >= 500) return "Não foi possível registrar as horas. Tente novamente.";
  }
  return "Não foi possível registrar as horas. Verifique sua conexão e tente novamente.";
}

function useVisualViewport(enabled: boolean) {
  const [viewport, setViewport] = useState(readVisualViewport);

  useEffect(() => {
    if (!enabled) return;
    const visualViewport = window.visualViewport;
    const update = () => setViewport(readVisualViewport());
    update();
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);

  return viewport;
}

function readVisualViewport() {
  const viewport = window.visualViewport;
  return {
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}
