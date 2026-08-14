import { useDraggable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import type { TaskCard as TaskCardData, TaskStatus } from "@/features/tasks/task-contracts";
import { QUICK_TASK_ACTIONS } from "@/features/tasks/task-transitions";
import { EditTaskDialog } from "./edit-task-dialog";

const priorityLabels = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
} as const;

export function TaskCard({
  task,
  pending = false,
  onTransition,
  onViewDetails,
  canEdit = false,
  companyId,
}: {
  task: TaskCardData;
  pending?: boolean;
  onTransition?: (task: TaskCardData, status: TaskStatus) => void;
  onViewDetails?: (task: TaskCardData) => void;
  canEdit?: boolean;
  companyId?: string;
}) {
  const actions = QUICK_TASK_ACTIONS[task.status];
  const draggable = useDraggable({
    id: `task:${task.id}`,
    data: { task },
    disabled: pending || actions.length === 0,
  });
  const style = draggable.transform
    ? { transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` }
    : undefined;

  return (
    <article
      ref={draggable.setNodeRef}
      style={style}
      className="kanban-card rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
      aria-busy={pending}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border px-2 py-1 text-xs font-medium">
          Prioridade {priorityLabels[task.priority]}
        </span>
        {actions.length > 0 && (
          <button
            ref={draggable.setActivatorNodeRef}
            type="button"
            className="kanban-card-move touch-none rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label={`Mover tarefa ${task.title}`}
            disabled={pending}
            {...draggable.listeners}
            {...draggable.attributes}
          >
            Mover
          </button>
        )}
      </div>
      <h3 className="mt-3 break-words text-sm font-semibold leading-5">{task.title}</h3>
      <dl className="mt-4 grid gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Responsável</dt>
          <dd className="mt-0.5 font-medium">{task.assignee?.name ?? "Sem responsável"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Requisition</dt>
          <dd className="mt-0.5 break-words font-medium">
            {task.requisition
              ? `#${task.requisition.number} · ${task.requisition.title}`
              : "Sem Requisition"}
          </dd>
        </div>
      </dl>
      <fieldset className="kanban-card-actions mt-4 flex flex-wrap gap-2">
        <legend className="sr-only">Ações de {task.title}</legend>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="kanban-card-action"
          disabled={pending}
          onClick={() => onViewDetails?.(task)}
          aria-label={`Ver detalhes da tarefa ${task.title}`}
        >
          Ver detalhes
        </Button>
        {actions.map((action) => (
          <Button
            key={action.status}
            type="button"
            size="sm"
            variant="outline"
            className="kanban-card-action"
            disabled={pending}
            onClick={() => onTransition?.(task, action.status)}
            aria-label={`${action.label} tarefa ${task.title}`}
          >
            {action.label}
          </Button>
        ))}
      </fieldset>
      {canEdit && companyId && (
        <div className="mt-4">
          <EditTaskDialog companyId={companyId} task={task} />
        </div>
      )}
      {pending && (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          Atualizando tarefa...
        </p>
      )}
    </article>
  );
}
