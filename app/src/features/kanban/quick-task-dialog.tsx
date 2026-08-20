import { useCallback, useEffect, useRef, useState } from "react";
import { IdLookupField } from "@/components/common/id-lookup-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { createMemberLookup, createRequisitionLookup } from "@/features/lookups/lookup-adapters";
import { useCreateTask } from "@/features/tasks/task-mutations";
import type { TaskLookupMember, TaskLookupRequisition } from "@/features/tasks/task-queries";

const PRIORITIES = [
  ["LOW", "Baixa"],
  ["MEDIUM", "Média"],
  ["HIGH", "Alta"],
] as const;

export function QuickTaskDialog({
  companyId,
  canCreate,
  members = [],
  requisitions = [],
  initialRequisitionId = "",
  triggerLabel = "Nova tarefa",
  enableMemberLookup = false,
  enableRequisitionLookup = false,
}: {
  companyId: string;
  canCreate: boolean;
  members?: TaskLookupMember[];
  requisitions?: TaskLookupRequisition[];
  initialRequisitionId?: string;
  triggerLabel?: string;
  enableMemberLookup?: boolean;
  enableRequisitionLookup?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [requisitionId, setRequisitionId] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const createTask = useCreateTask();

  const close = useCallback((): void => {
    setDialogOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!createTask.isSuccess) return;
    setTitle("");
    setPriority("MEDIUM");
    setAssigneeId("");
    setRequisitionId(initialRequisitionId);
    setDescription("");
    setStartDate("");
    setPlannedEndDate("");
    setValidationError(null);
    close();
    createTask.reset();
  }, [createTask.isSuccess, createTask.reset, close, initialRequisitionId]);

  function open(): void {
    setDialogOpen(true);
    setValidationError(null);
    setRequisitionId(initialRequisitionId);
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
    createTask.create({
      companyId,
      title: normalizedTitle,
      priority,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(requisitionId ? { requisitionId } : {}),
      ...(startDate ? { startDate } : {}),
      ...(plannedEndDate ? { plannedEndDate } : {}),
    });
  }

  const error = validationError ?? createTask.error;

  return (
    <>
      {canCreate && (
        <Button ref={triggerRef} type="button" onClick={open} aria-label="Nova tarefa">
          {triggerLabel}
        </Button>
      )}
      <ResponsiveDialog
        open={dialogOpen}
        titleId="quick-task-title"
        initialFocusRef={titleRef}
        onClose={close}
      >
        <header className="responsive-dialog-header">
          <div>
            <h2 id="quick-task-title" className="text-lg font-semibold">
              Nova tarefa
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Crie uma tarefa rápida no Kanban.</p>
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
        </header>
        <form className="contents" onSubmit={submit} noValidate>
          <main className="responsive-dialog-main">
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
              <Label htmlFor="quick-task-description">Descrição</Label>
              <textarea
                id="quick-task-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={createTask.isPending}
                className="min-h-20 rounded-md border bg-background p-3 text-sm"
              />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="quick-task-start-date">Data de início</Label>
                <Input
                  id="quick-task-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={createTask.isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quick-task-planned-end-date">Previsão de término</Label>
                <Input
                  id="quick-task-planned-end-date"
                  type="date"
                  value={plannedEndDate}
                  onChange={(event) => setPlannedEndDate(event.target.value)}
                  disabled={createTask.isPending}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="quick-task-priority">Prioridade</Label>
              <select
                id="quick-task-priority"
                className="responsive-dialog-control h-9 rounded-md border bg-background px-3 text-sm"
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
            <div className="mt-4 grid gap-2">
              {enableMemberLookup ? (
                <IdLookupField
                  label="Responsável"
                  value={assigneeId}
                  displayValue={
                    members.find((member) => member.userId === assigneeId)?.name ?? null
                  }
                  lookup={createMemberLookup(companyId)}
                  initialItems={members.map((member) => ({
                    id: member.userId,
                    label: member.name,
                  }))}
                  disabled={createTask.isPending}
                  onChange={(item) => setAssigneeId(item?.id ?? "")}
                />
              ) : (
                <>
                  <Label htmlFor="quick-task-assignee">Responsável</Label>
                  <select
                    id="quick-task-assignee"
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                    disabled={createTask.isPending}
                    className="responsive-dialog-control h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Sem responsável</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="mt-4 grid gap-2">
              {enableRequisitionLookup ? (
                <IdLookupField
                  label="Requisition"
                  value={requisitionId}
                  displayValue={
                    requisitions.find((item) => item.id === requisitionId)
                      ? `#${requisitions.find((item) => item.id === requisitionId)?.number} · ${requisitions.find((item) => item.id === requisitionId)?.title}`
                      : null
                  }
                  lookup={createRequisitionLookup(companyId)}
                  initialItems={requisitions.map((item) => ({
                    id: item.id,
                    label: `#${item.number} · ${item.title}`,
                  }))}
                  disabled={createTask.isPending}
                  onChange={(item) => setRequisitionId(item?.id ?? "")}
                />
              ) : (
                <>
                  <Label htmlFor="quick-task-requisition">Requisition</Label>
                  <select
                    id="quick-task-requisition"
                    value={requisitionId}
                    onChange={(event) => setRequisitionId(event.target.value)}
                    disabled={createTask.isPending}
                    className="responsive-dialog-control h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Sem Requisition</option>
                    {requisitions.map((item) => (
                      <option key={item.id} value={item.id}>
                        #{item.number} · {item.title}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </main>
          <footer className="responsive-dialog-footer">
            <Button type="button" variant="outline" onClick={close} disabled={createTask.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTask.isPending} aria-busy={createTask.isPending}>
              {createTask.isPending ? "Criando..." : "Criar tarefa"}
            </Button>
          </footer>
          {createTask.isPending && (
            <p className="sr-only" role="status">
              Criando tarefa...
            </p>
          )}
        </form>
      </ResponsiveDialog>
    </>
  );
}
