import { describe, expect, it } from "vitest";
import { parseMonthlyTimeline } from "./monthly-contracts";
import { monthlyTimeline } from "./monthly-test-fixtures";

describe("contrato da timeline mensal", () => {
  it("aceita o envelope mensal e preserva indicadores do backend", () => {
    expect(parseMonthlyTimeline(monthlyTimeline)).toEqual(monthlyTimeline);
  });

  it.each([
    { ...monthlyTimeline, extra: true },
    { ...monthlyTimeline, period: "2026-13" },
    { ...monthlyTimeline, items: [{ ...monthlyTimeline.items[0], extra: true }] },
    { ...monthlyTimeline, indicators: { ...monthlyTimeline.indicators, extra: 1 } },
    { ...monthlyTimeline, indicators: { ...monthlyTimeline.indicators, overdue: "1" } },
    { ...monthlyTimeline, items: [{ ...monthlyTimeline.items[0], deliveredOnTime: null }] },
    {
      ...monthlyTimeline,
      items: [{ ...monthlyTimeline.items[0], deliveredAt: "2026-02-30T10:00:00Z" }],
    },
  ])("rejeita payload inválido", (payload) => {
    expect(() => parseMonthlyTimeline(payload)).toThrow("Contrato da timeline mensal inválido");
  });
});
