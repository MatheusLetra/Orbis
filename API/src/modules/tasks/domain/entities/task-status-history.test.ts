import { describe, expect, it } from "vitest";
import { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

const changedAt = new Date("2026-08-12T12:00:00Z");

describe("TaskStatusHistory", () => {
  it("cria evento inicial null → TODO", () => {
    const history = TaskStatusHistory.createInitial({
      taskId: "task-1",
      changedBy: "user-1",
      changedAt,
    });

    expect(history.fromStatus).toBeNull();
    expect(history.toStatus).toBe("TODO");
    expect(history.changedBy).toBe("user-1");
    expect(history.changedAt).toBe(changedAt);
    expect(history.metadata).toBeNull();
  });

  it("preserva metadata backend", () => {
    const metadata = { source: "system", reason: "initial" };
    const history = TaskStatusHistory.createInitial({
      taskId: "task-1",
      changedBy: "user-1",
      metadata,
    });

    expect(history.metadata).toBe(metadata);
  });

  it("cria histórico para transições válidas", () => {
    const history = TaskStatusHistory.createTransition({
      taskId: "task-1",
      fromStatus: "IN_PROGRESS",
      toStatus: "DONE",
      changedBy: "user-1",
      changedAt,
      metadata: null,
    });

    expect(history.fromStatus).toBe("IN_PROGRESS");
    expect(history.toStatus).toBe("DONE");
    expect(history.changedBy).toBe("user-1");
    expect(history.changedAt).toBe(changedAt);
  });

  it.each([
    ["TODO", "TODO"],
    ["TODO", "PAUSED"],
    ["PAUSED", "DONE"],
    ["DONE", "TODO"],
  ] as const)("rejeita histórico inválido %s → %s", (fromStatus, toStatus) => {
    expect(() =>
      TaskStatusHistory.createTransition({
        taskId: "task-1",
        fromStatus,
        toStatus,
        changedBy: "user-1",
      }),
    ).toThrow(BusinessRuleError);
  });

  it("não expõe API de mutação", () => {
    const history = TaskStatusHistory.createInitial({ taskId: "task-1", changedBy: "user-1" });
    const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(history));

    expect(publicMethods).not.toContain("changeStatus");
    expect(publicMethods).not.toContain("update");
    expect(publicMethods).not.toContain("delete");
  });
});
