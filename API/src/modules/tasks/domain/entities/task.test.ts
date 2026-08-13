import { describe, expect, it } from "vitest";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  Task,
  type TaskProps,
} from "@/modules/tasks/domain/entities/task";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

const baseData = {
  companyId: "company-1",
  title: "  Executar tarefa  ",
};

function createTask() {
  return Task.create(baseData);
}

function restoreProps(overrides: Partial<TaskProps> = {}): TaskProps {
  const createdAt = new Date("2026-08-12T10:00:00Z");
  return {
    id: "task-1",
    companyId: "company-1",
    requisitionId: null,
    title: "Tarefa persistida",
    description: null,
    priority: "MEDIUM",
    status: "TODO",
    assigneeId: null,
    startDate: null,
    plannedEndDate: null,
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe("Task", () => {
  it("cria com TODO, prioridade MEDIUM e completedAt nulo", () => {
    const task = createTask();

    expect(task.status).toBe("TODO");
    expect(task.priority).toBe("MEDIUM");
    expect(task.completedAt).toBeNull();
    expect(task.title).toBe("Executar tarefa");
    expect(task.id).toEqual(expect.any(String));
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.updatedAt).toBe(task.createdAt);
  });

  it("mantém opcionais como null", () => {
    const task = createTask();

    expect(task.requisitionId).toBeNull();
    expect(task.description).toBeNull();
    expect(task.assigneeId).toBeNull();
    expect(task.startDate).toBeNull();
    expect(task.plannedEndDate).toBeNull();
  });

  it.each(TASK_PRIORITIES)("aceita a prioridade %s", (priority) => {
    expect(Task.create({ ...baseData, priority }).priority).toBe(priority);
  });

  it.each(["", "   "])('rejeita título "%s"', (title) => {
    expect(() => Task.create({ ...baseData, title })).toThrow(BusinessRuleError);
  });

  it("preserva os opcionais informados", () => {
    const startDate = new Date("2026-08-12T00:00:00Z");
    const plannedEndDate = new Date("2026-08-13T00:00:00Z");
    const task = Task.create({
      ...baseData,
      requisitionId: "requisition-1",
      description: "  Detalhes  ",
      assigneeId: "user-1",
      startDate,
      plannedEndDate,
    });

    expect(task.requisitionId).toBe("requisition-1");
    expect(task.description).toBe("Detalhes");
    expect(task.assigneeId).toBe("user-1");
    expect(task.startDate).toBe(startDate);
    expect(task.plannedEndDate).toBe(plannedEndDate);
  });

  it.each([
    ["TODO", "IN_PROGRESS"],
    ["IN_PROGRESS", "PAUSED"],
    ["PAUSED", "IN_PROGRESS"],
    ["PAUSED", "DONE"],
    ["IN_PROGRESS", "DONE"],
  ] as const)("permite %s → %s", (fromStatus, toStatus) => {
    const task = Task.restore(restoreProps({ status: fromStatus }));
    const occurredAt = new Date("2026-08-12T12:00:00Z");

    task.transitionTo(toStatus, occurredAt);

    expect(task.status).toBe(toStatus);
    expect(task.updatedAt).toBe(occurredAt);
  });

  it("usa o mesmo instante em completedAt e updatedAt ao concluir", () => {
    const task = Task.restore(restoreProps({ status: "IN_PROGRESS" }));
    const occurredAt = new Date("2026-08-12T12:00:00Z");

    task.transitionTo("DONE", occurredAt);

    expect(task.completedAt).toBe(occurredAt);
    expect(task.updatedAt).toBe(occurredAt);
  });

  it.each(
    TASK_STATUSES.flatMap((fromStatus) =>
      TASK_STATUSES.map((toStatus) => [fromStatus, toStatus]),
    ).filter(
      ([fromStatus, toStatus]) =>
        !(
          (fromStatus === "TODO" && toStatus === "IN_PROGRESS") ||
          (fromStatus === "IN_PROGRESS" && ["PAUSED", "DONE"].includes(toStatus)) ||
          (fromStatus === "PAUSED" && ["IN_PROGRESS", "DONE"].includes(toStatus))
        ),
    ),
  )("rejeita %s → %s", (fromStatus, toStatus) => {
    const task = Task.restore(
      restoreProps({
        status: fromStatus,
        completedAt: fromStatus === "DONE" ? new Date() : null,
      }),
    );

    expect(() => task.transitionTo(toStatus)).toThrow(BusinessRuleError);
  });

  it("restaura preservando timestamps e valores persistidos", () => {
    const createdAt = new Date("2026-08-10T10:00:00Z");
    const updatedAt = new Date("2026-08-11T10:00:00Z");
    const task = Task.restore(restoreProps({ createdAt, updatedAt, status: "IN_PROGRESS" }));

    expect(task.createdAt).toBe(createdAt);
    expect(task.updatedAt).toBe(updatedAt);
    expect(task.status).toBe("IN_PROGRESS");
  });

  it("restaura DONE com completedAt", () => {
    const completedAt = new Date("2026-08-12T12:00:00Z");
    const task = Task.restore(restoreProps({ status: "DONE", completedAt }));

    expect(task.completedAt).toBe(completedAt);
  });

  it("rejeita DONE sem completedAt", () => {
    expect(() => Task.restore(restoreProps({ status: "DONE" }))).toThrow(BusinessRuleError);
  });

  it("rejeita status não-DONE com completedAt", () => {
    expect(() =>
      Task.restore(restoreProps({ status: "IN_PROGRESS", completedAt: new Date() })),
    ).toThrow(BusinessRuleError);
  });

  it("permite mutações específicas antes de DONE e atualiza updatedAt", () => {
    const task = createTask();
    const originalUpdatedAt = task.updatedAt;

    task.rename("Novo título");
    task.changeDescription("Descrição");
    task.changePriority("HIGH");
    task.changeAssignee("user-1");
    task.changeRequisition("requisition-1");
    task.changeStartDate(new Date("2026-08-12T00:00:00Z"));
    task.changePlannedEndDate(new Date("2026-08-13T00:00:00Z"));

    expect(task.title).toBe("Novo título");
    expect(task.description).toBe("Descrição");
    expect(task.priority).toBe("HIGH");
    expect(task.assigneeId).toBe("user-1");
    expect(task.requisitionId).toBe("requisition-1");
    expect(task.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
  });

  it("normaliza alterações opcionais para null", () => {
    const task = Task.create({
      ...baseData,
      description: "Descrição",
      assigneeId: "user-1",
      requisitionId: "requisition-1",
    });

    task.changeDescription(null);
    task.changeAssignee(null);
    task.changeRequisition(null);
    task.changeStartDate(null);
    task.changePlannedEndDate(null);

    expect(task.description).toBeNull();
    expect(task.assigneeId).toBeNull();
    expect(task.requisitionId).toBeNull();
    expect(task.startDate).toBeNull();
    expect(task.plannedEndDate).toBeNull();
  });

  it("rejeita mutações depois de DONE", () => {
    const task = Task.restore(
      restoreProps({ status: "DONE", completedAt: new Date("2026-08-12T12:00:00Z") }),
    );

    expect(() => task.rename("Novo título")).toThrow(BusinessRuleError);
    expect(() => task.changeDescription("Descrição")).toThrow(BusinessRuleError);
    expect(() => task.changePriority("HIGH")).toThrow(BusinessRuleError);
    expect(() => task.changeAssignee("user-1")).toThrow(BusinessRuleError);
    expect(() => task.changeRequisition("requisition-1")).toThrow(BusinessRuleError);
    expect(() => task.changeStartDate(new Date())).toThrow(BusinessRuleError);
    expect(() => task.changePlannedEndDate(new Date())).toThrow(BusinessRuleError);
  });
});
