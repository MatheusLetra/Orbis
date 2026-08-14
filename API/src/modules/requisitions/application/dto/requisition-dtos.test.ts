import { describe, expect, it } from "vitest";

import {
  createRequisitionSchema,
  listRequisitionsSchema,
  updateRequisitionSchema,
} from "./requisition-dtos";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

describe("requisition DTO schemas", () => {
  it("normaliza create com campos válidos", () => {
    const plannedDeliveryDate = new Date("2026-08-20T00:00:00.000Z");

    expect(
      createRequisitionSchema.parse({
        title: "  Nova requisição  ",
        description: "  Detalhes  ",
        priority: "MEDIUM",
        responsibleId: uuid,
        estimatedHours: 8,
        plannedDeliveryDate,
      }),
    ).toEqual({
      title: "Nova requisição",
      description: "Detalhes",
      priority: "MEDIUM",
      responsibleId: uuid,
      estimatedHours: 8,
      plannedDeliveryDate,
    });
  });

  it.each([
    { title: "" },
    { title: "Requisição", responsibleId: "invalid" },
    { title: "Requisição", priority: "URGENT" },
    { title: "Requisição", startDate: "2026-08-14" },
  ])("rejeita create inválido %#", (input) => {
    expect(createRequisitionSchema.safeParse(input).success).toBe(false);
  });

  it("exige update não vazio, rejeita campo desconhecido e aceita limpeza explícita", () => {
    expect(updateRequisitionSchema.safeParse({}).success).toBe(false);
    expect(updateRequisitionSchema.safeParse({ title: "Nova", unknown: true }).success).toBe(false);
    expect(
      updateRequisitionSchema.parse({
        responsibleId: null,
        deliveredAt: null,
        estimatedHours: null,
      }),
    ).toEqual({ responsibleId: null, deliveredAt: null, estimatedHours: null });
  });

  it("normaliza pesquisa e mantém filtros válidos", () => {
    expect(
      listRequisitionsSchema.parse({
        status: "IN_PROGRESS",
        priority: "HIGH",
        responsibleId: uuid,
        search: "  RQ-10  ",
      }),
    ).toEqual({
      status: "IN_PROGRESS",
      priority: "HIGH",
      responsibleId: uuid,
      search: "RQ-10",
    });
    expect(listRequisitionsSchema.parse({ search: "   " })).toEqual({ search: undefined });
  });

  it.each([
    { status: "UNKNOWN" },
    { priority: "URGENT" },
    { responsibleId: "invalid" },
    { search: "a".repeat(201) },
    { extra: true },
  ])("rejeita filtros inválidos %#", (input) => {
    expect(listRequisitionsSchema.safeParse(input).success).toBe(false);
  });
});
