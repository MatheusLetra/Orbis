import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { timeEntriesClient } from "./time-entry-client";
import { timeEntryKeys } from "./time-entry-keys";
import { useTaskTimeEntries } from "./time-entry-queries";

const response = { items: [], totalDurationMinutes: 0, hasMore: false };

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

describe("useTaskTimeEntries", () => {
  it.each([
    [null, "task-a", true],
    ["company-a", null, true],
    ["company-a", "task-a", false],
  ] as const)("não requisita sem company/task/enabled", (companyId, taskId, enabled) => {
    const request = vi.spyOn(timeEntriesClient, "listForTask");
    const { result } = renderHook(() => useTaskTimeEntries(companyId, taskId, { enabled }), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(request).not.toHaveBeenCalled();
  });

  it("carrega sob demanda com limit e AbortSignal", async () => {
    const request = vi.spyOn(timeEntriesClient, "listForTask").mockResolvedValue(response);
    const client = createQueryClient();
    const { result } = renderHook(
      () => useTaskTimeEntries("company-a", "task-a", { enabled: true, limit: 25 }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledWith("company-a", "task-a", {
      limit: 25,
      signal: expect.any(AbortSignal),
    });
    expect(client.getQueryData(timeEntryKeys.task("company-a", "task-a", 25))).toEqual(response);
    expect(client.getQueryData(timeEntryKeys.task("company-b", "task-a", 25))).toBeUndefined();
  });
});
