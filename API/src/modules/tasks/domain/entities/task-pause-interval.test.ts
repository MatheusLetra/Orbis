import { describe, expect, it } from "vitest";

import { TaskPauseInterval } from "@/modules/tasks/domain/entities/task-pause-interval";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const INTERVAL_ID = "22222222-2222-4222-8222-222222222222";
const STARTED_AT = new Date("2026-08-13T10:00:00.250Z");

describe("TaskPauseInterval", () => {
  it("cria um intervalo aberto", () => {
    const interval = TaskPauseInterval.createOpen(
      { taskId: TASK_ID, startedAt: STARTED_AT },
      INTERVAL_ID,
    );

    expect(interval).toMatchObject({
      id: INTERVAL_ID,
      taskId: TASK_ID,
      startedAt: STARTED_AT,
      endedAt: null,
      durationSeconds: null,
    });
  });

  it("fecha uma única vez e calcula segundos inteiros", () => {
    const interval = TaskPauseInterval.createOpen({ taskId: TASK_ID, startedAt: STARTED_AT });
    const endedAt = new Date("2026-08-13T10:01:01.999Z");

    interval.close(endedAt);

    expect(interval.endedAt).toBe(endedAt);
    expect(interval.durationSeconds).toBe(61);
    expect(() => interval.close(endedAt)).toThrow(BusinessRuleError);
  });

  it("rejeita fim anterior ao início", () => {
    const interval = TaskPauseInterval.createOpen({ taskId: TASK_ID, startedAt: STARTED_AT });

    expect(() => interval.close(new Date("2026-08-13T10:00:00.249Z"))).toThrow(BusinessRuleError);
  });

  it("rejeita estado persistido inconsistente ou negativo", () => {
    expect(() =>
      TaskPauseInterval.restore({
        id: INTERVAL_ID,
        taskId: TASK_ID,
        startedAt: STARTED_AT,
        endedAt: new Date("2026-08-13T10:00:01Z"),
        durationSeconds: null,
      }),
    ).toThrow(BusinessRuleError);
    expect(() =>
      TaskPauseInterval.restore({
        id: INTERVAL_ID,
        taskId: TASK_ID,
        startedAt: STARTED_AT,
        endedAt: STARTED_AT,
        durationSeconds: -1,
      }),
    ).toThrow(BusinessRuleError);
    expect(() =>
      TaskPauseInterval.restore({
        id: INTERVAL_ID,
        taskId: TASK_ID,
        startedAt: STARTED_AT,
        endedAt: STARTED_AT,
        durationSeconds: 0.5,
      }),
    ).toThrow(BusinessRuleError);
  });
});
