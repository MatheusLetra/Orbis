import { describe, expect, it } from "vitest";
import { parseTaskReport } from "./report-contracts";

const valid = {
  companyId: "company",
  items: [
    {
      id: "task",
      title: "Task",
      status: "DONE",
      priority: "HIGH",
      issuedAt: "2026-08-01T10:00:00.000Z",
      plannedEndDate: null,
      completedAt: null,
      assigneeId: null,
      assigneeName: null,
      requisitionId: null,
      requisitionNumber: null,
      requisitionTitle: null,
      estimatedHours: null,
      workedHours: 0,
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  hasMore: false,
};
describe("contrato do relatório", () => {
  it("aceita item sem requisition/assignee", () => expect(parseTaskReport(valid)).toEqual(valid));
  it.each([
    { ...valid, extra: true },
    { ...valid, items: [{ ...valid.items[0], status: "INVALID" }] },
    { ...valid, total: -1 },
  ])("rejeita payload inválido", (payload) => expect(() => parseTaskReport(payload)).toThrow());
});
