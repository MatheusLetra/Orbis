import { describe, expect, it } from "vitest";
import { normalizeReportFilters, reportKeys } from "./report-keys";

describe("keys de relatório", () => {
  it("remove filtros vazios e isola tenant/página", () => {
    expect(normalizeReportFilters({ employeeId: "", priority: "HIGH" })).toEqual({
      priority: "HIGH",
    });
    expect(reportKeys.list("a", 1, {})).not.toEqual(reportKeys.list("b", 1, {}));
  });
});
