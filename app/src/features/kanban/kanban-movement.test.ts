import { describe, expect, it } from "vitest";
import type { TaskCard, TaskStatus } from "@/features/tasks/task-contracts";
import { canTransitionTask, QUICK_TASK_ACTIONS } from "@/features/tasks/task-transitions";
import { resolveTaskDrop } from "./kanban-board";

const task = { id: "task-1", status: "TODO" } as TaskCard;

describe("movimentos do Kanban", () => {
  it.each([
    ["TODO", "IN_PROGRESS"],
    ["IN_PROGRESS", "PAUSED"],
    ["IN_PROGRESS", "DONE"],
    ["PAUSED", "IN_PROGRESS"],
  ] as const)("permite %s → %s", (from, to) => {
    expect(canTransitionTask(from, to)).toBe(true);
    expect(resolveTaskDrop({ ...task, status: from }, to)).toEqual({
      task: { ...task, status: from },
      status: to,
    });
  });

  it.each([
    ["TODO", "TODO"],
    ["PAUSED", "DONE"],
    ["DONE", "IN_PROGRESS"],
  ] as [TaskStatus, TaskStatus][])("trata %s → %s como no-op", (from, to) => {
    expect(resolveTaskDrop({ ...task, status: from }, to)).toBeNull();
  });

  it("mantém ações rápidas alinhadas aos destinos", () => {
    expect(QUICK_TASK_ACTIONS.TODO).toEqual([{ label: "Iniciar", status: "IN_PROGRESS" }]);
    expect(QUICK_TASK_ACTIONS.IN_PROGRESS).toEqual([
      { label: "Pausar", status: "PAUSED" },
      { label: "Concluir", status: "DONE" },
    ]);
    expect(QUICK_TASK_ACTIONS.PAUSED).toEqual([{ label: "Retomar", status: "IN_PROGRESS" }]);
    expect(QUICK_TASK_ACTIONS.DONE).toEqual([]);
  });
});
