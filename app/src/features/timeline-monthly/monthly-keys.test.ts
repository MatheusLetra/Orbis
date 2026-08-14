import { describe, expect, it } from "vitest";
import { monthlyTimelineKeys, normalizeMonthlyFilters } from "./monthly-keys";

describe("keys da timeline mensal", () => {
  it("incluem tenant, período e filtros normalizados", () => {
    expect(
      monthlyTimelineKeys.list("company-a", "2026-08", { assigneeId: "", priority: "HIGH" }),
    ).toEqual([
      "timeline-monthly",
      "company-a",
      "2026-08",
      { priority: "HIGH", assigneeId: undefined, status: undefined },
    ]);
    expect(normalizeMonthlyFilters({ assigneeId: "" }).assigneeId).toBeUndefined();
  });
});
