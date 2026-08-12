import { describe, expect, it } from "vitest";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { groupTasksByStatus } from "./group-tasks";

function task(id: string, status: TaskCard["status"]): TaskCard {
  return {
    id,
    companyId: "company-a",
    requisitionId: null,
    title: id,
    description: null,
    priority: "MEDIUM",
    status,
    assigneeId: null,
    startDate: null,
    plannedEndDate: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    assignee: null,
    requisition: null,
  };
}

describe("groupTasksByStatus", () => {
  it("mantém as quatro colunas, classifica uma vez e preserva ordem", () => {
    const tasks = [
      task("todo-1", "TODO"),
      task("paused-1", "PAUSED"),
      task("done-1", "DONE"),
      task("todo-2", "TODO"),
      task("progress-1", "IN_PROGRESS"),
    ];
    const grouped = groupTasksByStatus(tasks);
    expect(Object.keys(grouped)).toEqual(["TODO", "IN_PROGRESS", "PAUSED", "DONE"]);
    expect(grouped.TODO.map(({ id }) => id)).toEqual(["todo-1", "todo-2"]);
    expect(grouped.IN_PROGRESS.map(({ id }) => id)).toEqual(["progress-1"]);
    expect(grouped.PAUSED.map(({ id }) => id)).toEqual(["paused-1"]);
    expect(grouped.DONE.map(({ id }) => id)).toEqual(["done-1"]);
    expect(Object.values(grouped).flat()).toHaveLength(tasks.length);
  });

  it("mantém colunas vazias", () => {
    const grouped = groupTasksByStatus([task("todo-1", "TODO")]);
    expect(grouped.IN_PROGRESS).toEqual([]);
    expect(grouped.PAUSED).toEqual([]);
    expect(grouped.DONE).toEqual([]);
  });

  it("falha explicitamente para status inesperado", () => {
    const invalid = task("invalid", "TODO") as TaskCard & { status: string };
    (invalid as { status: string }).status = "UNKNOWN";
    expect(() => groupTasksByStatus([invalid])).toThrow("Status de tarefa desconhecido");
  });
});
