import type { TaskCard, TaskStatus } from "@/features/tasks/task-contracts";

export const KANBAN_COLUMNS = [
  { status: "TODO", label: "A Fazer" },
  { status: "IN_PROGRESS", label: "Em Andamento" },
  { status: "PAUSED", label: "Pausado" },
  { status: "DONE", label: "Concluído" },
] as const satisfies readonly { status: TaskStatus; label: string }[];

export type KanbanColumnStatus = (typeof KANBAN_COLUMNS)[number]["status"];

export type GroupedTasks = Record<KanbanColumnStatus, TaskCard[]>;
