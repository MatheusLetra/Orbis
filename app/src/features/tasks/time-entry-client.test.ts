import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { timeEntriesClient } from "./time-entry-client";

describe("time entries client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("usa endpoint codificado e não envia limit por padrão", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({
      items: [],
      totalDurationMinutes: 0,
      hasMore: false,
    });
    await timeEntriesClient.listForTask("company/a", "task/b");
    expect(request).toHaveBeenCalledWith("/companies/company%2Fa/tasks/task%2Fb/time-entries", {
      signal: undefined,
    });
  });

  it("envia limit explícito e repassa AbortSignal", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({
      items: [],
      totalDurationMinutes: 0,
      hasMore: false,
    });
    const signal = new AbortController().signal;
    await timeEntriesClient.listForTask("company-a", "task-a", { limit: 25, signal });
    expect(request).toHaveBeenCalledWith(
      "/companies/company-a/tasks/task-a/time-entries?limit=25",
      { signal },
    );
  });
});
