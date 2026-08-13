import { describe, expect, it } from "vitest";

import {
  TIME_ENTRY_MAX_DURATION_MINUTES,
  TimeEntry,
} from "@/modules/tasks/domain/entities/time-entry";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

const base = {
  companyId: "11111111-1111-4111-8111-111111111111",
  taskId: "22222222-2222-4222-8222-222222222222",
  userId: "33333333-3333-4333-8333-333333333333",
  createdAt: new Date("2026-08-13T12:00:00Z"),
};

describe("TimeEntry", () => {
  it("cria apontamento manual com intervalos nulos", () => {
    const entry = TimeEntry.create({ ...base, durationMinutes: 90, description: "  Trabalho  " });

    expect(entry).toMatchObject({
      ...base,
      durationMinutes: 90,
      description: "Trabalho",
      startedAt: null,
      endedAt: null,
    });
  });

  it("normaliza descrição vazia para null", () => {
    expect(
      TimeEntry.create({ ...base, durationMinutes: 1, description: "   " }).description,
    ).toBeNull();
    expect(TimeEntry.create({ ...base, durationMinutes: 1 }).description).toBeNull();
  });

  it.each([0, -1, 1.5, TIME_ENTRY_MAX_DURATION_MINUTES + 1])(
    "rejeita duração inválida %s",
    (durationMinutes) => {
      expect(() => TimeEntry.create({ ...base, durationMinutes })).toThrow(BusinessRuleError);
    },
  );

  it("aceita os limites de duração", () => {
    expect(TimeEntry.create({ ...base, durationMinutes: 1 }).durationMinutes).toBe(1);
    expect(
      TimeEntry.create({ ...base, durationMinutes: TIME_ENTRY_MAX_DURATION_MINUTES })
        .durationMinutes,
    ).toBe(TIME_ENTRY_MAX_DURATION_MINUTES);
  });

  it("rejeita descrição acima de 1000 caracteres e intervalos persistidos", () => {
    expect(() =>
      TimeEntry.create({ ...base, durationMinutes: 1, description: "x".repeat(1001) }),
    ).toThrow(BusinessRuleError);
    expect(() =>
      TimeEntry.restore({
        id: "44444444-4444-4444-8444-444444444444",
        ...base,
        startedAt: new Date(),
        endedAt: null,
        durationMinutes: 1,
        description: null,
      }),
    ).toThrow(BusinessRuleError);
  });
});
