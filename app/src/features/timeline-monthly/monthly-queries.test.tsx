import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { monthlyTimelineClient } from "./monthly-client";
import { useMonthlyTimeline } from "./monthly-queries";
import { monthlyTimeline } from "./monthly-test-fixtures";

describe("query da timeline mensal", () => {
  it("fica desabilitada sem tenant ou período válido", () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useMonthlyTimeline(null, "2026-13"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("usa tenant/período/filtros e encaminha o signal", async () => {
    const request = vi.spyOn(monthlyTimelineClient, "list").mockResolvedValue(monthlyTimeline);
    const client = new QueryClient();
    const { result } = renderHook(
      () => useMonthlyTimeline("company-a", "2026-08", { priority: "HIGH" }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledWith(
      "company-a",
      "2026-08",
      { priority: "HIGH" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
