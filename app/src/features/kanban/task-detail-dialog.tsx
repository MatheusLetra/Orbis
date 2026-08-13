import { useCallback, useEffect, useRef } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import type { TaskCard, TaskDetail, TaskStatus } from "@/features/tasks/task-contracts";
import { useTaskDetail } from "@/features/tasks/task-queries";
import { ApiError } from "@/lib/http/api-error";

const statusLabels: Record<TaskStatus, string> = {
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausado",
  DONE: "Concluído",
};

const priorityLabels = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
} as const;

interface TaskDetailDialogProps {
  companyId: string;
  task: TaskCard | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailDialog({ companyId, task, isOpen, onClose }: TaskDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  const taskId = task?.id ?? null;
  const detailQuery = useTaskDetail(isOpen ? companyId : null, taskId);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    window.setTimeout(() => {
      const previous = previousActiveElement.current;
      if (previous instanceof HTMLElement) previous.focus();
      previousActiveElement.current = null;
    }, 0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [close]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reabrir/refocar ao trocar de task
  useEffect(() => {
    if (!isOpen) {
      const dialog = dialogRef.current;
      if (dialog?.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      return;
    }

    previousActiveElement.current = document.activeElement;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.setTimeout(() => titleRef.current?.focus(), 0);
  }, [isOpen, taskId]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  const detail = detailQuery.data;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="task-detail-title"
      className="w-[min(100%-2rem,40rem)] rounded-xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
      onKeyDown={handleKeyDown}
    >
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2
            id="task-detail-title"
            ref={titleRef}
            tabIndex={-1}
            className="text-lg font-semibold outline-none"
          >
            Detalhes da tarefa
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Fechar
          </Button>
        </div>
        {detailQuery.isPending && <LoadingState label="Carregando detalhes..." />}
        {detailQuery.isError && (
          <ErrorState
            message={messageForDetailError(detailQuery.error)}
            onRetry={() => void detailQuery.refetch()}
          />
        )}
        {!detailQuery.isPending && !detailQuery.isError && detail && (
          <TaskDetailContent task={task} detail={detail} />
        )}
        {!detailQuery.isPending && !detailQuery.isError && !detail && (
          <EmptyState title="Nenhuma tarefa selecionada" />
        )}
      </div>
    </dialog>
  );
}

function TaskDetailContent({ task, detail }: { task: TaskCard | null; detail: TaskDetail }) {
  return (
    <div className="grid gap-6">
      <section>
        <h3 className="text-base font-semibold">{detail.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border px-2 py-1 font-medium">
            Prioridade {priorityLabels[detail.priority]}
          </span>
          <span className="rounded-full border px-2 py-1 font-medium">
            {statusLabels[detail.status]}
          </span>
        </div>
      </section>

      <dl className="grid gap-3 text-sm">
        <DetailItem label="Descrição">
          {detail.description ? detail.description : "Sem descrição"}
        </DetailItem>
        <DetailItem label="Responsável">
          {task?.assignee?.name ?? (detail.assigneeId ? detail.assigneeId : "Sem responsável")}
        </DetailItem>
        <DetailItem label="Requisition">
          {task?.requisition
            ? `#${task.requisition.number} · ${task.requisition.title}`
            : detail.requisitionId
              ? detail.requisitionId
              : "Sem Requisition"}
        </DetailItem>
        <DetailItem label="Data de início">
          {detail.startDate ? formatDate(detail.startDate) : "Não definida"}
        </DetailItem>
        <DetailItem label="Previsão de término">
          {detail.plannedEndDate ? formatDate(detail.plannedEndDate) : "Não definida"}
        </DetailItem>
        <DetailItem label="Concluída em">
          {detail.completedAt ? formatDate(detail.completedAt) : "Não concluída"}
        </DetailItem>
        <DetailItem label="Criada em">{formatDate(detail.createdAt)}</DetailItem>
        <DetailItem label="Atualizada em">{formatDate(detail.updatedAt)}</DetailItem>
      </dl>

      <section>
        <h4 className="mb-2 text-sm font-semibold">Histórico de status</h4>
        {detail.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração de status registrada.</p>
        ) : (
          <ol className="grid gap-2">
            {detail.history.map((entry) => (
              <li key={entry.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {entry.fromStatus ? statusLabels[entry.fromStatus] : "Criação"} →{" "}
                    {statusLabels[entry.toStatus]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.changedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function messageForDetailError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Você não tem permissão para visualizar esta tarefa.";
    if (error.status === 404) return "A tarefa não foi encontrada. O board será atualizado.";
    if (error.status >= 500) return "Não foi possível carregar os detalhes. Tente novamente.";
  }
  return "Não foi possível carregar os detalhes. Verifique sua conexão e tente novamente.";
}
