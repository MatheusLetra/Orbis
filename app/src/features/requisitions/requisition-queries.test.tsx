import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { requisitionsClient } from "./requisition-client";
import { requisitionKeys } from "./requisition-keys";
import { useRequisitions } from "./requisition-queries";

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

describe("useRequisitions", () => {
  it("não consulta sem empresa", () => {
    const list = vi.spyOn(requisitionsClient, "list");
    const { result } = renderHook(() => useRequisitions(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(list).not.toHaveBeenCalled();
  });

  it("repassa filtros e signal e armazena na chave tenant-aware", async () => {
    const response = [{ id: "req-a", title: "Ajuste" }];
    const filters = { status: "OPEN" as const, priority: "HIGH" as const, search: " Ajuste " };
    const list = vi.spyOn(requisitionsClient, "list").mockResolvedValue(response as never);
    const client = createQueryClient();
    const { result } = renderHook(() => useRequisitions("company-a", filters), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.data).toBe(response));
    expect(list).toHaveBeenCalledWith("company-a", filters, {
      signal: expect.any(AbortSignal),
    });
    expect(client.getQueryData(requisitionKeys.list("company-a", filters))).toBe(response);
    expect(client.getQueryData(requisitionKeys.list("company-b", filters))).toBeUndefined();
  });
});
