import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyCapabilities } from "@/features/companies/capabilities-contracts";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { useRegisterTimeEntry } from "@/features/tasks/time-entry-mutations";
import { ApiError } from "@/lib/http/api-error";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const taskContext = `${companyId}:${task.id}`;
  const previousTaskContext = useRef(taskContext);
  const registerTimeEntry = useRegisterTimeEntry(companyId, task.id, {
    onSuccess: () => {
      if (!isOpen || !dialogRef.current?.open) return;
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
      const dialog = dialogRef.current;
      if (dialog?.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
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
    const dialog = dialogRef.current;
    if (!dialog) return;
    setValidationError(null);
    registerTimeEntry.clearError();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.setTimeout(() => durationRef.current?.focus(), 0);
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
  const dialog = (
    <dialog
      ref={dialogRef}
      aria-labelledby={`register-time-entry-title-${task.id}`}
      className="w-[min(100%-2rem,32rem)] rounded-xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
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
        </div>
        <form onSubmit={submit} noValidate>
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
          <div className="mt-6 flex justify-end gap-2">
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
          </div>
          {registerTimeEntry.isPending && (
            <p className="mt-3 text-right text-xs text-muted-foreground" role="status">
              Registrando horas...
            </p>
          )}
        </form>
      </div>
    </dialog>
  );

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
