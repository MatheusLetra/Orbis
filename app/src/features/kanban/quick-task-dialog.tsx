import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTask } from "@/features/tasks/task-mutations";

const PRIORITIES = [
  ["LOW", "Baixa"],
  ["MEDIUM", "Média"],
  ["HIGH", "Alta"],
] as const;

export function QuickTaskDialog({
  companyId,
  canCreate,
}: {
  companyId: string;
  canCreate: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [validationError, setValidationError] = useState<string | null>(null);
  const createTask = useCreateTask();

  const close = useCallback((): void => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      triggerRef.current?.focus();
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  useEffect(() => {
    if (!createTask.isSuccess) return;
    setTitle("");
    setPriority("MEDIUM");
    setValidationError(null);
    close();
    createTask.reset();
  }, [createTask.isSuccess, createTask.reset, close]);

  function open(): void {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    setValidationError(null);
    window.setTimeout(() => titleRef.current?.focus(), 0);
  }

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setValidationError("Informe um título para a tarefa.");
      titleRef.current?.focus();
      return;
    }
    setValidationError(null);
    createTask.create({ companyId, title: normalizedTitle, priority });
  }

  const error = validationError ?? createTask.error;

  return (
    <>
      {canCreate && (
        <Button ref={triggerRef} type="button" onClick={open} aria-label="Nova tarefa">
          Nova tarefa
        </Button>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby="quick-task-title"
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
              <h2 id="quick-task-title" className="text-lg font-semibold">
                Nova tarefa
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie uma tarefa rápida no Kanban.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={close}
              disabled={createTask.isPending}
            >
              Fechar
            </Button>
          </div>
          <form onSubmit={submit} noValidate>
            <div className="grid gap-2">
              <Label htmlFor="quick-task-title-input">Título</Label>
              <Input
                ref={titleRef}
                id="quick-task-title-input"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (validationError) setValidationError(null);
                  if (createTask.error) createTask.clearError();
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "quick-task-error" : undefined}
                disabled={createTask.isPending}
              />
              {error && (
                <p id="quick-task-error" className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="quick-task-priority">Prioridade</Label>
              <select
                id="quick-task-priority"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={priority}
                onChange={(event) => setPriority(event.target.value as typeof priority)}
                disabled={createTask.isPending}
              >
                {PRIORITIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={createTask.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createTask.isPending}
                aria-busy={createTask.isPending}
              >
                {createTask.isPending ? "Criando..." : "Criar tarefa"}
              </Button>
            </div>
            {createTask.isPending && (
              <p className="mt-3 text-right text-xs text-muted-foreground" role="status">
                Criando tarefa...
              </p>
            )}
          </form>
        </div>
      </dialog>
    </>
  );
}
