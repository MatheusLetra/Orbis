import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { reportClient } from "./report-client";
import { useTaskReport } from "./report-queries";

vi.mock("./report-client", () => ({ reportClient: { list: vi.fn() } }));
describe("query do relatório", () => {
  it("usa tenant/filtros/página e signal", async () => {
    vi.mocked(reportClient.list).mockResolvedValue({
      companyId: "a",
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = renderHook(() => useTaskReport("a", { status: "DONE" }, 2), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(reportClient.list).toHaveBeenCalledWith(
      "a",
      { status: "DONE" },
      2,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("permanece desabilitada sem tenant", () => {
    const client = new QueryClient();
    const view = renderHook(() => useTaskReport(null, {}, 1), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(view.result.current.fetchStatus).toBe("idle");
  });
});
