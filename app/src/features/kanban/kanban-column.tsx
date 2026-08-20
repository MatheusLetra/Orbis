import { useDroppable } from "@dnd-kit/core";
import { EmptyState } from "@/components/common/empty-state";
import type { TaskCard as TaskCardData, TaskStatus } from "@/features/tasks/task-contracts";
import type { TaskLookupMember, TaskLookupRequisition } from "@/features/tasks/task-queries";
import { TaskCard } from "./task-card";

export function KanbanColumn({
  label,
  status,
  tasks,
  pendingTaskIds,
  validDropTarget,
  onTransition,
  onViewDetails,
  canEdit,
  companyId,
  members,
  requisitions,
  enableMemberLookup,
  enableRequisitionLookup,
}: {
  label: string;
  status: TaskStatus;
  tasks: TaskCardData[];
  pendingTaskIds?: ReadonlySet<string>;
  validDropTarget?: boolean;
  onTransition?: (task: TaskCardData, status: TaskStatus) => void;
  onViewDetails?: (task: TaskCardData) => void;
  canEdit?: (task: TaskCardData) => boolean;
  companyId?: string;
  members?: TaskLookupMember[];
  requisitions?: TaskLookupRequisition[];
  enableMemberLookup?: boolean;
  enableRequisitionLookup?: boolean;
}) {
  const droppable = useDroppable({ id: `column:${status}`, data: { status } });
  return (
    <section
      ref={droppable.setNodeRef}
      className={`kanban-column flex min-h-72 flex-col rounded-xl p-3 ${
        droppable.isOver && validDropTarget ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/50"
      }`}
      aria-labelledby={`kanban-column-${status}`}
    >
      <div className="kanban-column-header flex items-center justify-between gap-3 px-1 pb-3">
        <h2 id={`kanban-column-${status}`} className="font-semibold">
          {label}
        </h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="grid content-start gap-3">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              pending={pendingTaskIds?.has(task.id)}
              onTransition={onTransition}
              onViewDetails={onViewDetails}
              canEdit={canEdit?.(task)}
              companyId={companyId}
              members={members}
              requisitions={requisitions}
              enableMemberLookup={enableMemberLookup}
              enableRequisitionLookup={enableRequisitionLookup}
            />
          ))
        ) : (
          <EmptyState title="Coluna vazia" description="Nenhuma tarefa neste status." />
        )}
      </div>
    </section>
  );
}
