import { describe, expect, it } from "vitest";
import { taskReportQuerySchema } from "@/modules/reports/application/dto/task-report-dtos";

describe("contrato de filtros do relatório", () => {
  it("aceita período inclusivo válido e defaults", () => {
    expect(
      taskReportQuerySchema.parse({ periodStart: "2026-08-01", periodEnd: "2026-08-01" }),
    ).toMatchObject({ page: 1, limit: 50 });
  });
  it.each([
    { periodStart: "2026-08-01" },
    { periodStart: "2026-08-02", periodEnd: "2026-08-01" },
    { periodStart: "2026-02-30", periodEnd: "2026-03-01" },
    { page: 0 },
    { limit: 101 },
  ])("rejeita filtro inválido %#", (input) =>
    expect(() => taskReportQuerySchema.parse(input)).toThrow(),
  );
});
