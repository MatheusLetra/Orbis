import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { useUpdateTask } from "@/features/tasks/task-mutations";

const PRIORITIES = [
  ["LOW", "Baixa"],
  ["MEDIUM", "Média"],
  ["HIGH", "Alta"],
] as const;

export function EditTaskDialog({ companyId, task }: { companyId: string; task: TaskCard }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const updateTask = useUpdateTask();

  const close = useCallback(() => {
    setDialogOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!updateTask.isSuccess) return;
    close();
    updateTask.reset();
  }, [close, updateTask.isSuccess, updateTask.reset]);

  function open() {
    setTitle(task.title);
    setPriority(task.priority);
    setValidationError(null);
    updateTask.clearError();
    setDialogOpen(true);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setValidationError("Informe um título para a tarefa.");
      titleRef.current?.focus();
      return;
    }
    setValidationError(null);
    updateTask.update({ companyId, taskId: task.id, title: normalizedTitle, priority });
  }

  const error = validationError ?? updateTask.error;
  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        variant="outline"
        onClick={open}
        aria-label={`Editar tarefa ${task.title}`}
      >
        Editar
      </Button>
      <ResponsiveDialog
        open={dialogOpen}
        titleId={`edit-task-title-${task.id}`}
        initialFocusRef={titleRef}
        onClose={close}
      >
        <header className="responsive-dialog-header">
          <div>
            <h2 id={`edit-task-title-${task.id}`} className="text-lg font-semibold">
              Editar tarefa
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Atualize o título e a prioridade.</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={close}
            disabled={updateTask.isPending}
          >
            Fechar
          </Button>
        </header>
        <form className="contents" onSubmit={submit} noValidate>
          <main className="responsive-dialog-main">
            <div className="grid gap-2">
              <Label htmlFor={`edit-task-input-${task.id}`}>Título</Label>
              <Input
                ref={titleRef}
                id={`edit-task-input-${task.id}`}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setValidationError(null);
                  updateTask.clearError();
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `edit-task-error-${task.id}` : undefined}
                disabled={updateTask.isPending}
              />
              {error && (
                <p
                  id={`edit-task-error-${task.id}`}
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-2">
              <Label htmlFor={`edit-task-priority-${task.id}`}>Prioridade</Label>
              <select
                id={`edit-task-priority-${task.id}`}
                className="responsive-dialog-control h-9 rounded-md border bg-background px-3 text-sm"
                value={priority}
                onChange={(event) => setPriority(event.target.value as typeof priority)}
                disabled={updateTask.isPending}
              >
                {PRIORITIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </main>
          <footer className="responsive-dialog-footer">
            <Button type="button" variant="outline" onClick={close} disabled={updateTask.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateTask.isPending} aria-busy={updateTask.isPending}>
              {updateTask.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </footer>
          {updateTask.isPending && (
            <p className="sr-only" role="status">
              Salvando tarefa...
            </p>
          )}
        </form>
      </ResponsiveDialog>
    </>
  );
}
