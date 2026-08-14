import { describe, expect, it } from "vitest";
import { isValidYear, parseYearlyTimeline } from "./yearly-contracts";

const item = {
  requisitionId: "id",
  number: 1,
  title: "R",
  priority: "HIGH",
  assigneeId: null,
  startDate: "2026-01-01",
  plannedDeliveryDate: "2026-01-02",
  deliveredAt: null,
  estimatedHours: 1,
  isOverdue: false,
  deliveredOnTime: false,
};
function payload() {
  return {
    companyId: "company",
    year: "2026",
    months: Array.from({ length: 12 }, (_, index) => ({
      period: `2026-${String(index + 1).padStart(2, "0")}`,
      requisitionCount: 1,
      countsByPriority: { LOW: 0, MEDIUM: 0, HIGH: 1 },
      estimatedHours: 1,
      deliveredOnTime: 0,
      overdue: 0,
      items: [item],
      undatedItems: [],
    })),
    indicators: { totalRequisitions: 1, estimatedHours: 1, deliveredOnTime: 0, overdue: 0 },
  };
}

describe("yearly contracts", () => {
  it("valida ano e exige doze meses", () => {
    expect(isValidYear("2026")).toBe(true);
    expect(isValidYear("2026-01")).toBe(false);
    expect(parseYearlyTimeline(payload()).months).toHaveLength(12);
  });
  it("rejeita shape desconhecido", () => {
    expect(() => parseYearlyTimeline({ ...payload(), extra: true })).toThrow();
  });
  it("rejeita mês e item inválidos", () => {
    const invalidMonth = payload();
    const firstInvalidMonth = invalidMonth.months[0];
    if (!firstInvalidMonth) throw new Error("Mês ausente");
    firstInvalidMonth.period = "2026-13";
    expect(() => parseYearlyTimeline(invalidMonth)).toThrow();
    const invalidItem = payload();
    const firstInvalidItem = invalidItem.months[0]?.items[0];
    if (!firstInvalidItem) throw new Error("Item ausente");
    firstInvalidItem.estimatedHours = -1;
    expect(() => parseYearlyTimeline(invalidItem)).toThrow();
  });
});
