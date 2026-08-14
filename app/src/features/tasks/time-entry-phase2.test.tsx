import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { timeEntriesClient } from "./time-entry-client";
import { parseTimeEntryListOutput, parseTimeEntryOutput } from "./time-entry-contracts";
import { DEFAULT_TIME_ENTRY_LIMIT, timeEntryKeys } from "./time-entry-keys";
import { useTaskTimeEntries } from "./time-entry-queries";

const entry = {
  id: "entry-a",
  companyId: "company-a",
  taskId: "task-a",
  userId: "user-a",
  startedAt: "2026-08-14T10:00:00.000Z",
  endedAt: null,
  durationMinutes: 1,
  description: null,
  createdAt: "2026-08-14T10:00:00.000Z",
};

describe("time entry phase 2 contracts", () => {
  it("usa o limite default quando a query é habilitada", async () => {
    const response = { items: [], totalDurationMinutes: 0, hasMore: false };
    const list = vi.spyOn(timeEntriesClient, "listForTask").mockResolvedValue(response);
    const client = createQueryClient();
    const { result } = renderHook(
      () => useTaskTimeEntries("company-a", "task-a", { enabled: true }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledWith("company-a", "task-a", {
      limit: DEFAULT_TIME_ENTRY_LIMIT,
      signal: expect.any(AbortSignal),
    });
    expect(
      client.getQueryData(timeEntryKeys.task("company-a", "task-a", DEFAULT_TIME_ENTRY_LIMIT)),
    ).toBe(response);
  });

  it("aceita os limites inclusivos de duração", () => {
    expect(parseTimeEntryOutput(entry).durationMinutes).toBe(1);
    expect(parseTimeEntryOutput({ ...entry, durationMinutes: 1440 }).durationMinutes).toBe(1440);
  });

  it.each([
    { ...entry, id: 1 },
    { ...entry, durationMinutes: 0 },
    { ...entry, durationMinutes: 1441 },
    { ...entry, endedAt: false },
    { ...entry, createdAt: null },
  ])("rejeita apontamento inválido %#", (value) => {
    expect(() => parseTimeEntryOutput(value)).toThrow("Contrato de apontamento inválido");
  });

  it.each([
    { items: [], totalDurationMinutes: 1.5, hasMore: false },
    { items: [], totalDurationMinutes: 0, hasMore: "false" },
    { items: "invalid", totalDurationMinutes: 0, hasMore: false },
  ])("rejeita lista inválida %#", (value) => {
    expect(() => parseTimeEntryListOutput(value)).toThrow("Contrato de apontamentos inválido");
  });
});
