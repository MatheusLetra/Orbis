import { describe, expect, it } from "vitest";
import { parseTimeEntryListOutput } from "./time-entry-contracts";

const entry = {
  id: "entry-a",
  companyId: "company-a",
  taskId: "task-a",
  userId: "user-a",
  startedAt: null,
  endedAt: null,
  durationMinutes: 90,
  description: "Work",
  createdAt: "2026-08-13T12:00:00.000Z",
};

describe("time entry contracts", () => {
  it("parseia resposta válida", () => {
    expect(
      parseTimeEntryListOutput({ items: [entry], totalDurationMinutes: 90, hasMore: false }),
    ).toEqual({ items: [entry], totalDurationMinutes: 90, hasMore: false });
  });

  it.each([
    null,
    {},
    { items: [], totalDurationMinutes: -1, hasMore: false },
    { items: [{}], totalDurationMinutes: 0, hasMore: false },
    { items: [{ ...entry, durationMinutes: 1.5 }], totalDurationMinutes: 1, hasMore: false },
    { items: [{ ...entry, startedAt: 123 }], totalDurationMinutes: 90, hasMore: false },
  ])("rejeita resposta inválida", (value) => {
    expect(() => parseTimeEntryListOutput(value)).toThrow();
  });
});
