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
import type { TaskLookupMember, TaskLookupRequisition } from "@/features/tasks/task-queries";
import { canTransitionTask } from "@/features/tasks/task-transitions";
import { groupTasksByStatus } from "./group-tasks";
import { KanbanColumn } from "./kanban-column";
import { KANBAN_COLUMNS } from "./kanban-contracts";
import "./kanban-layout.css";

export function KanbanBoard({
  tasks,
  pendingTaskIds = new Set(),
  onTransition,
  onViewDetails,
  canEdit,
  companyId,
  members,
  requisitions,
}: {
  tasks: readonly TaskCard[];
  pendingTaskIds?: ReadonlySet<string>;
  onTransition?: (task: TaskCard, status: TaskStatus) => void;
  onViewDetails?: (task: TaskCard) => void;
  canEdit?: (task: TaskCard) => boolean;
  companyId?: string;
  members?: TaskLookupMember[];
  requisitions?: TaskLookupRequisition[];
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
      <div className="kanban-board-shell">
        <p className="kanban-board-hint" id="kanban-board-navigation-hint">
          Deslize horizontalmente para acessar todas as colunas.
        </p>
        <section
          className="kanban-board-scroll"
          aria-describedby="kanban-board-navigation-hint"
          aria-label="Colunas do board"
          onFocusCapture={scrollFocusedControlIntoView}
        >
          {KANBAN_COLUMNS.map((column) => (
            <div key={column.status} className="kanban-board-column-slot">
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
                members={members}
                requisitions={requisitions}
              />
            </div>
          ))}
        </section>
      </div>
      <DragOverlay>
        {activeTask ? (
          <div
            className="kanban-drag-overlay rounded-lg border bg-card p-4 shadow-lg"
            aria-hidden="true"
          >
            <p className="text-sm font-semibold">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function scrollFocusedControlIntoView(event: React.FocusEvent<HTMLElement>): void {
  const board = event.currentTarget;
  const target = event.target;
  if (!(target instanceof HTMLElement) || target === board) return;
  const boardRect = board.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (targetRect.left < boardRect.left) {
    board.scrollTo({
      left: board.scrollLeft + targetRect.left - boardRect.left,
      behavior: "auto",
    });
  } else if (targetRect.right > boardRect.right) {
    board.scrollTo({
      left:
        board.scrollLeft +
        (targetRect.left + targetRect.width / 2) -
        (boardRect.left + boardRect.width / 2),
      behavior: "auto",
    });
  }
}

export function resolveTaskDrop(
  task: TaskCard | null | undefined,
  status: TaskStatus | undefined,
): { task: TaskCard; status: TaskStatus } | null {
  return task && status && canTransitionTask(task.status, status) ? { task, status } : null;
}
