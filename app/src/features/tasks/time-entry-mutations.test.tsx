import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { timeEntriesClient } from "./time-entry-client";
import { timeEntryKeys } from "./time-entry-keys";
import { useRegisterTimeEntry } from "./time-entry-mutations";

const output = {
  id: "entry-1",
  companyId: "company-a",
  taskId: "task-a",
  userId: "user-a",
  startedAt: null,
  endedAt: null,
  durationMinutes: 90,
  description: "Implementação",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function wrapper(client: ReturnType<typeof createQueryClient>) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useRegisterTimeEntry", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("registra, invalida somente a task e bloqueia duplicidade sem optimistic insert", async () => {
    const client = createQueryClient();
    const create = vi.spyOn(timeEntriesClient, "createForTask").mockResolvedValue(output);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    client.setQueryData(timeEntryKeys.task("company-a", "task-a", 25), {
      items: [],
      totalDurationMinutes: 0,
      hasMore: false,
    });
    const { result } = renderHook(() => useRegisterTimeEntry("company-a", "task-a"), {
      wrapper: wrapper(client),
    });

    act(() => {
      expect(result.current.register({ durationMinutes: 90 })).toBe(true);
      expect(result.current.register({ durationMinutes: 90 })).toBe(false);
    });
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(client.getQueryData(timeEntryKeys.task("company-a", "task-a", 25))).toEqual({
      items: [],
      totalDurationMinutes: 0,
      hasMore: false,
    });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: timeEntryKeys.taskPrefix("company-a", "task-a"),
      }),
    );
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: timeEntryKeys.taskPrefix("company-a", "task-b"),
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: timeEntryKeys.taskPrefix("company-b", "task-a"),
    });
  });

  it("repassa AbortSignal e cancela silenciosamente no desmontar", async () => {
    let signal: AbortSignal | null | undefined;
    vi.spyOn(timeEntriesClient, "createForTask").mockImplementation((_c, _t, _i, options) => {
      signal = options?.signal;
      return new Promise(() => undefined);
    });
    const { result, unmount } = renderHook(() => useRegisterTimeEntry("company-a", "task-a"), {
      wrapper: wrapper(createQueryClient()),
    });
    act(() => result.current.register({ durationMinutes: 10 }));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("não chama sucesso nem invalida resposta stale", async () => {
    const client = createQueryClient();
    let resolveCreate: (value: typeof output) => void = () => undefined;
    const onSuccess = vi.fn();
    const create = vi
      .spyOn(timeEntriesClient, "createForTask")
      .mockImplementation(() => new Promise((resolve) => (resolveCreate = resolve)));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useRegisterTimeEntry("company-a", "task-a", { onSuccess }),
      { wrapper: wrapper(client) },
    );
    act(() => result.current.register({ durationMinutes: 10 }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    act(() => result.current.abort());
    resolveCreate(output);
    await Promise.resolve();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("confirma sucesso após invalidação e expõe clear/reset", async () => {
    const client = createQueryClient();
    const onSuccess = vi.fn();
    vi.spyOn(timeEntriesClient, "createForTask").mockResolvedValue(output);
    const { result } = renderHook(
      () => useRegisterTimeEntry("company-a", "task-a", { onSuccess }),
      { wrapper: wrapper(client) },
    );
    act(() => result.current.register({ durationMinutes: 30, description: "feito" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledWith(output);
    act(() => {
      result.current.clearError();
      result.current.reset();
    });
    expect(result.current.error).toBeNull();
  });

  it("ignora AbortError e erro stale após abort", async () => {
    let rejectCreate: (cause: unknown) => void = () => undefined;
    const onError = vi.fn();
    vi.spyOn(timeEntriesClient, "createForTask").mockImplementation(
      () => new Promise((_resolve, reject) => (rejectCreate = reject)),
    );
    const { result } = renderHook(() => useRegisterTimeEntry("company-a", "task-a", { onError }), {
      wrapper: wrapper(createQueryClient()),
    });
    act(() => result.current.register({ durationMinutes: 10 }));
    act(() => result.current.abort());
    rejectCreate(new DOMException("Aborted", "AbortError"));
    await Promise.resolve();
    expect(result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("aborta e reseta estado ao trocar tenant/Task e bloqueia IDs ausentes", async () => {
    vi.spyOn(timeEntriesClient, "createForTask").mockImplementation(
      () => new Promise(() => undefined),
    );
    const { result, rerender } = renderHook(
      ({ companyId, taskId }) => useRegisterTimeEntry(companyId, taskId),
      {
        initialProps: {
          companyId: "company-a" as string | null,
          taskId: "task-a" as string | null,
        },
        wrapper: wrapper(createQueryClient()),
      },
    );
    act(() => result.current.register({ durationMinutes: 10 }));
    rerender({ companyId: "company-b", taskId: "task-b" });
    await waitFor(() => expect(result.current.isSuccess).toBe(false));
    rerender({ companyId: null, taskId: "task-b" });
    expect(result.current.register({ durationMinutes: 10 })).toBe(false);
  });

  it("permite hooks de tasks diferentes operarem independentemente", async () => {
    const create = vi.spyOn(timeEntriesClient, "createForTask").mockResolvedValue(output);
    const client = createQueryClient();
    const first = renderHook(() => useRegisterTimeEntry("company-a", "task-a"), {
      wrapper: wrapper(client),
    });
    const second = renderHook(() => useRegisterTimeEntry("company-a", "task-b"), {
      wrapper: wrapper(client),
    });
    act(() => {
      expect(first.result.current.register({ durationMinutes: 10 })).toBe(true);
      expect(second.result.current.register({ durationMinutes: 20 })).toBe(true);
    });
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls.map(([companyId, taskId]) => `${companyId}/${taskId}`)).toEqual([
      "company-a/task-a",
      "company-a/task-b",
    ]);
  });

  it.each([400, 401, 403, 404, 422, 500])("preserva erro HTTP %s", async (status) => {
    const error = new ApiError({ status, code: "ERROR", message: "falha" });
    const onError = vi.fn();
    vi.spyOn(timeEntriesClient, "createForTask").mockRejectedValue(error);
    const { result } = renderHook(() => useRegisterTimeEntry("company-a", "task-a", { onError }), {
      wrapper: wrapper(createQueryClient()),
    });
    act(() => result.current.register({ durationMinutes: 10 }));
    await waitFor(() => expect(result.current.error).toBe(error));
    expect(onError).toHaveBeenCalledWith(error);
  });
});
