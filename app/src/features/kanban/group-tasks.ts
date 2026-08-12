import type { TaskCard, TaskStatus } from "@/features/tasks/task-contracts";
import { type GroupedTasks, KANBAN_COLUMNS } from "./kanban-contracts";

const knownStatuses = new Set<TaskStatus>(KANBAN_COLUMNS.map((column) => column.status));

export function groupTasksByStatus(tasks: readonly TaskCard[]): GroupedTasks {
  const grouped = Object.fromEntries(
    KANBAN_COLUMNS.map((column) => [column.status, [] as TaskCard[]]),
  ) as GroupedTasks;

  for (const task of tasks) {
    if (!knownStatuses.has(task.status)) {
      throw new Error(`Status de tarefa desconhecido: ${String(task.status)}`);
    }
    grouped[task.status].push(task);
  }

  return grouped;
}
