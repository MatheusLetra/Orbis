import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import type { TaskCard, TaskStatus } from "@/features/tasks/task-contracts";
import { canTransitionTask } from "@/features/tasks/task-transitions";
import { groupTasksByStatus } from "./group-tasks";
import { KanbanColumn } from "./kanban-column";
import { KANBAN_COLUMNS } from "./kanban-contracts";

export function KanbanBoard({
  tasks,
  pendingTaskIds = new Set(),
  onTransition,
  onViewDetails,
  canEdit,
  companyId,
}: {
  tasks: readonly TaskCard[];
  pendingTaskIds?: ReadonlySet<string>;
  onTransition?: (task: TaskCard, status: TaskStatus) => void;
  onViewDetails?: (task: TaskCard) => void;
  canEdit?: (task: TaskCard) => boolean;
  companyId?: string;
}) {
  const grouped = groupTasksByStatus(tasks);
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveTask((event.active.data.current?.task as TaskCard | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const task = (event.active.data.current?.task as TaskCard | undefined) ?? activeTask;
    const status = event.over?.data.current?.status as TaskStatus | undefined;
    setActiveTask(null);
    const transition = resolveTaskDrop(task, status);
    if (transition) onTransition?.(transition.task, transition.status);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveTask(null)}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para mover uma tarefa, pressione espaço, use as setas até uma coluna válida e pressione espaço novamente. Pressione escape para cancelar.",
        },
      }}
    >
      <section
        className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        aria-label="Colunas do board"
      >
        {KANBAN_COLUMNS.map((column) => (
          <div key={column.status} className="snap-start">
            <KanbanColumn
              status={column.status}
              label={column.label}
              tasks={grouped[column.status]}
              pendingTaskIds={pendingTaskIds}
              validDropTarget={Boolean(
                activeTask && canTransitionTask(activeTask.status, column.status),
              )}
              onTransition={onTransition}
              onViewDetails={onViewDetails}
              canEdit={canEdit}
              companyId={companyId}
            />
          </div>
        ))}
      </section>
      <DragOverlay>
        {activeTask ? (
          <div className="w-72 rounded-lg border bg-card p-4 shadow-lg" aria-hidden="true">
            <p className="text-sm font-semibold">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function resolveTaskDrop(
  task: TaskCard | null | undefined,
  status: TaskStatus | undefined,
): { task: TaskCard; status: TaskStatus } | null {
  return task && status && canTransitionTask(task.status, status) ? { task, status } : null;
}
