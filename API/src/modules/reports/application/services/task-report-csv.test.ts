import { describe, expect, it } from "vitest";
import type { TaskReportItem } from "@/modules/reports/application/read-models/task-report";
import { taskReportToCsv } from "@/modules/reports/application/services/task-report-csv";

const item: TaskReportItem = {
  id: "1",
  title: "Título, longo",
  status: "DONE",
  priority: "HIGH",
  issuedAt: "2026-08-01T10:00:00.000Z",
  plannedEndDate: "2026-08-02",
  completedAt: null,
  assigneeId: null,
  assigneeName: null,
  requisitionId: null,
  requisitionNumber: null,
  requisitionTitle: null,
  estimatedHours: null,
  workedHours: 1.5,
};
describe("CSV do relatório", () => {
  it("inclui cabeçalho, aspas e campos nulos", () => {
    const csv = taskReportToCsv([item]);
    expect(csv).toContain("status,priority,title");
    expect(csv).toContain('"Título, longo"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("exporta relatório vazio com cabeçalho", () =>
    expect(taskReportToCsv([]).split("\r\n")).toHaveLength(2));
});
