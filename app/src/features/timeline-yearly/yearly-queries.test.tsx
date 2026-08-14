import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { yearlyTimelineClient } from "./yearly-client";
import type { YearlyTimeline } from "./yearly-contracts";
import { useYearlyTimeline } from "./yearly-queries";

const timeline: YearlyTimeline = {
  companyId: "company-a",
  year: "2026",
  months: Array.from({ length: 12 }, (_, index) => ({
    period: `2026-${String(index + 1).padStart(2, "0")}`,
    requisitionCount: 0,
    countsByPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 },
    estimatedHours: 0,
    deliveredOnTime: 0,
    overdue: 0,
    items: [],
    undatedItems: [],
  })),
  indicators: { totalRequisitions: 0, estimatedHours: 0, deliveredOnTime: 0, overdue: 0 },
};

describe("query da timeline anual", () => {
  it("fica desabilitada sem tenant ou ano válido", () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useYearlyTimeline(null, "20x6"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("usa tenant, ano, filtros e signal", async () => {
    const request = vi.spyOn(yearlyTimelineClient, "list").mockResolvedValue(timeline);
    const client = new QueryClient();
    const { result } = renderHook(
      () => useYearlyTimeline("company-a", "2026", { priority: "HIGH" }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledWith(
      "company-a",
      "2026",
      { priority: "HIGH" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("invalida capabilities quando a API retorna 403", async () => {
    vi.spyOn(yearlyTimelineClient, "list").mockRejectedValue(
      new ApiError({ status: 403, code: "FORBIDDEN", message: "Sem acesso" }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useYearlyTimeline("company-a", "2026"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalled();
  });
});
