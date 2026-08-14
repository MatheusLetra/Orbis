import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { capabilitiesKeys } from "@/features/companies/capabilities-keys";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { timelineClient } from "./timeline-client";
import { timelineKeys } from "./timeline-keys";
import { useWeeklyTimeline } from "./timeline-queries";
import { weeklyTimeline } from "./timeline-test-fixtures";

describe("useWeeklyTimeline", () => {
  it.each([
    [null, "2026-08-17"],
    ["company-a", "invalid"],
    ["company-a", "2026-08-18"],
  ])("não consulta sem tenant e weekStart válido/segunda (%s, %s)", (companyId, weekStart) => {
    const weekly = vi.spyOn(timelineClient, "weekly");
    const { result } = renderHook(() => useWeeklyTimeline(companyId, weekStart), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(weekly).not.toHaveBeenCalled();
  });

  it("usa signal e cache tenant/week/filter-aware", async () => {
    const filters = { status: "PAUSED" as const };
    const weekly = vi.spyOn(timelineClient, "weekly").mockResolvedValue(weeklyTimeline);
    const client = createQueryClient();
    const { result } = renderHook(() => useWeeklyTimeline("company-a", "2026-08-17", filters), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(result.current.data).toEqual(weeklyTimeline));
    expect(weekly).toHaveBeenCalledWith("company-a", "2026-08-17", filters, {
      signal: expect.any(AbortSignal),
    });
    expect(client.getQueryData(timelineKeys.weekly("company-a", "2026-08-17", filters))).toEqual(
      weeklyTimeline,
    );
  });

  it("invalida somente capabilities do tenant atual após 403", async () => {
    vi.spyOn(timelineClient, "weekly").mockRejectedValue(
      new ApiError({ status: 403, code: "FORBIDDEN", message: "negado" }),
    );
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useWeeklyTimeline("company-a", "2026-08-17"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: capabilitiesKeys.company("company-a") });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: capabilitiesKeys.company("company-b"),
    });
  });
});
