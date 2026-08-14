import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { tasksClient } from "./task-client";
import { taskKeys } from "./task-keys";
import { useTaskDetail, useTasks } from "./task-queries";

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

describe("task queries uncovered contracts", () => {
  it.each([
    [null, "task-a"],
    ["company-a", null],
  ] as const)("não busca detalhe sem os dois IDs", (companyId, taskId) => {
    const detail = vi.spyOn(tasksClient, "detail");
    const { result } = renderHook(() => useTaskDetail(companyId, taskId), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(detail).not.toHaveBeenCalled();
  });

  it("busca detalhe com cancelamento e chave tenant-aware", async () => {
    const response = { id: "task-a", title: "Detalhe", history: [] };
    const detail = vi.spyOn(tasksClient, "detail").mockResolvedValue(response as never);
    const client = createQueryClient();
    const { result } = renderHook(() => useTaskDetail("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.data).toBe(response));
    expect(detail).toHaveBeenCalledWith("company-a", "task-a", {
      signal: expect.any(AbortSignal),
    });
    expect(client.getQueryData(taskKeys.detail("company-a", "task-a"))).toBe(response);
    expect(client.getQueryData(taskKeys.detail("company-b", "task-a"))).toBeUndefined();
  });

  it("não lista tasks sem empresa", () => {
    const list = vi.spyOn(tasksClient, "list");
    const { result } = renderHook(() => useTasks(null, { status: "TODO" }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(list).not.toHaveBeenCalled();
  });
});
