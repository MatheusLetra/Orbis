import { describe, expect, it } from "vitest";

import { createTaskSchema, listTasksSchema, updateTaskSchema } from "./task-dtos";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

describe("task DTO schemas", () => {
  it("normaliza create e aceita os campos opcionais válidos", () => {
    const startDate = new Date("2026-08-14T00:00:00.000Z");

    expect(
      createTaskSchema.parse({
        title: "  Implementar testes  ",
        description: "  Cobertura real  ",
        priority: "HIGH",
        assigneeId: uuid,
        requisitionId: uuid,
        startDate,
      }),
    ).toEqual({
      title: "Implementar testes",
      description: "Cobertura real",
      priority: "HIGH",
      assigneeId: uuid,
      requisitionId: uuid,
      startDate,
    });
  });

  it.each([
    { title: " " },
    { title: "Tarefa", assigneeId: "invalid" },
    { title: "Tarefa", priority: "URGENT" },
    { title: "Tarefa", unknown: true },
  ])("rejeita create inválido %#", (input) => {
    expect(createTaskSchema.safeParse(input).success).toBe(false);
  });

  it("rejeita intervalo de calendário invertido na criação", () => {
    expect(
      createTaskSchema.safeParse({
        title: "Tarefa",
        startDate: new Date("2026-08-25T00:00:00Z"),
        plannedEndDate: new Date("2026-08-20T00:00:00Z"),
      }).success,
    ).toBe(false);
  });

  it("exige ao menos um campo no update e preserva null explícito", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.parse({ description: null, assigneeId: null })).toEqual({
      description: null,
      assigneeId: null,
    });
  });

  it("aplica scope default e transforma pesquisa vazia em undefined", () => {
    expect(listTasksSchema.parse({ search: "   " })).toEqual({
      scope: "company",
      search: undefined,
    });
    expect(listTasksSchema.parse({ scope: "own", search: "  fila  " })).toEqual({
      scope: "own",
      search: "fila",
    });
  });

  it.each([
    { scope: "all" },
    { status: "UNKNOWN" },
    { search: "a".repeat(201) },
    { requisitionId: "invalid" },
    { extra: true },
  ])("rejeita filtros inválidos %#", (input) => {
    expect(listTasksSchema.safeParse(input).success).toBe(false);
  });
});
