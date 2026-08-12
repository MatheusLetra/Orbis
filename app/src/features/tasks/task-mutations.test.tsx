import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { tasksClient } from "./task-client";
import type { TaskCard, TaskOutput, TaskStatus } from "./task-contracts";
import { taskKeys } from "./task-keys";
import { messageForTransitionError, useTaskTransition } from "./task-mutations";

function task(id: string, status: TaskStatus = "TODO"): TaskCard {
  return {
    id,
    companyId: "company-a",
    requisitionId: null,
    title: id,
    description: null,
    priority: "MEDIUM",
    status,
    assigneeId: "user-a",
    startDate: null,
    plannedEndDate: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    assignee: { id: "user-a", name: "Ana" },
    requisition: null,
  };
}

function output(value: TaskCard): TaskOutput {
  const { assignee: _assignee, requisition: _requisition, ...result } = value;
  return result;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("useTaskTransition", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("aplica optimistic, reconcilia, preserva summaries e invalida", async () => {
    const client = createQueryClient();
    const queryKey = taskKeys.list("company-a");
    const original = task("task-a");
    client.setQueryData(queryKey, [original]);
    const request = deferred<TaskOutput>();
    vi.spyOn(tasksClient, "transition").mockReturnValue(request.promise);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useTaskTransition(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      expect(
        result.current.transition({
          companyId: "company-a",
          taskId: "task-a",
          fromStatus: "TODO",
          status: "IN_PROGRESS",
        }),
      ).toBe(true);
    });
    await waitFor(() =>
      expect(client.getQueryData<TaskCard[]>(queryKey)?.[0]?.status).toBe("IN_PROGRESS"),
    );
    expect(result.current.pendingTaskIds.has("task-a")).toBe(true);

    request.resolve({
      ...output(original),
      status: "IN_PROGRESS",
      updatedAt: "2026-02-01T00:00:00Z",
    });
    await waitFor(() => expect(result.current.pendingTaskIds.has("task-a")).toBe(false));
    expect(client.getQueryData<TaskCard[]>(queryKey)?.[0]).toMatchObject({
      status: "IN_PROGRESS",
      updatedAt: "2026-02-01T00:00:00Z",
      assignee: original.assignee,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskKeys.lists("company-a") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskKeys.detail("company-a", "task-a") });
  });

  it("bloqueia segunda mutation da mesma Task e permite Tasks diferentes", async () => {
    const client = createQueryClient();
    client.setQueryData(taskKeys.list("company-a"), [task("task-a"), task("task-b")]);
    const requests = [deferred<TaskOutput>(), deferred<TaskOutput>()];
    const transition = vi
      .spyOn(tasksClient, "transition")
      .mockReturnValueOnce(requests[0]?.promise as Promise<TaskOutput>)
      .mockReturnValueOnce(requests[1]?.promise as Promise<TaskOutput>);
    const { result } = renderHook(() => useTaskTransition(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      expect(
        result.current.transition({
          companyId: "company-a",
          taskId: "task-a",
          fromStatus: "TODO",
          status: "IN_PROGRESS",
        }),
      ).toBe(true);
      expect(
        result.current.transition({
          companyId: "company-a",
          taskId: "task-a",
          fromStatus: "TODO",
          status: "IN_PROGRESS",
        }),
      ).toBe(false);
      expect(
        result.current.transition({
          companyId: "company-a",
          taskId: "task-b",
          fromStatus: "TODO",
          status: "IN_PROGRESS",
        }),
      ).toBe(true);
    });
    await waitFor(() => expect(transition).toHaveBeenCalledTimes(2));
    requests[0]?.resolve({ ...output(task("task-a")), status: "IN_PROGRESS" });
    requests[1]?.resolve({ ...output(task("task-b")), status: "IN_PROGRESS" });
    await waitFor(() => expect(result.current.pendingTaskIds.size).toBe(0));
  });

  it("faz rollback somente da Task com erro e preserva outro optimistic", async () => {
    const client = createQueryClient();
    const key = taskKeys.list("company-a");
    client.setQueryData(key, [task("task-a"), task("task-b")]);
    const failed = deferred<TaskOutput>();
    const successful = deferred<TaskOutput>();
    vi.spyOn(tasksClient, "transition")
      .mockReturnValueOnce(failed.promise)
      .mockReturnValueOnce(successful.promise);
    const { result } = renderHook(() => useTaskTransition(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      result.current.transition({
        companyId: "company-a",
        taskId: "task-a",
        fromStatus: "TODO",
        status: "IN_PROGRESS",
      });
      result.current.transition({
        companyId: "company-a",
        taskId: "task-b",
        fromStatus: "TODO",
        status: "IN_PROGRESS",
      });
    });
    await waitFor(() =>
      expect(
        client.getQueryData<TaskCard[]>(key)?.every((item) => item.status === "IN_PROGRESS"),
      ).toBe(true),
    );
    failed.reject(new ApiError({ status: 403, code: "FORBIDDEN", message: "negado" }));
    await waitFor(() =>
      expect(
        client.getQueryData<TaskCard[]>(key)?.find((item) => item.id === "task-a")?.status,
      ).toBe("TODO"),
    );
    expect(client.getQueryData<TaskCard[]>(key)?.find((item) => item.id === "task-b")?.status).toBe(
      "IN_PROGRESS",
    );
    expect(result.current.error).toContain("permissão");
    successful.resolve({ ...output(task("task-b")), status: "IN_PROGRESS" });
  });

  it("não altera outro tenant e rejeita transição inválida antes da API", () => {
    const client = createQueryClient();
    client.setQueryData(taskKeys.list("company-a"), [task("task-a", "PAUSED")]);
    client.setQueryData(taskKeys.list("company-b"), [
      { ...task("task-a"), companyId: "company-b" },
    ]);
    const transition = vi.spyOn(tasksClient, "transition");
    const { result } = renderHook(() => useTaskTransition(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    act(() => {
      expect(
        result.current.transition({
          companyId: "company-a",
          taskId: "task-a",
          fromStatus: "PAUSED",
          status: "DONE",
        }),
      ).toBe(false);
    });
    expect(transition).not.toHaveBeenCalled();
    expect(client.getQueryData<TaskCard[]>(taskKeys.list("company-b"))?.[0]?.status).toBe("TODO");
  });

  it("não sobrescreve refetch canônico com resposta ou rollback antigos", async () => {
    const client = createQueryClient();
    const key = taskKeys.list("company-a");
    client.setQueryData(key, [task("task-a")]);
    const request = deferred<TaskOutput>();
    vi.spyOn(tasksClient, "transition").mockReturnValue(request.promise);
    const { result } = renderHook(() => useTaskTransition(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    act(() => {
      result.current.transition({
        companyId: "company-a",
        taskId: "task-a",
        fromStatus: "TODO",
        status: "IN_PROGRESS",
      });
    });
    await waitFor(() =>
      expect(client.getQueryData<TaskCard[]>(key)?.[0]?.status).toBe("IN_PROGRESS"),
    );
    const canonical = { ...task("task-a", "DONE"), completedAt: "2026-03-01T00:00:00Z" };
    client.setQueryData(key, [canonical]);
    request.resolve({ ...output(task("task-a", "IN_PROGRESS")), updatedAt: "2026-02-01" });
    await waitFor(() => expect(result.current.pendingTaskIds.size).toBe(0));
    expect(client.getQueryData<TaskCard[]>(key)?.[0]).toEqual(canonical);
  });
});

describe("messageForTransitionError", () => {
  it.each([
    [403, "permissão"],
    [404, "não foi encontrada"],
    [409, "outra operação"],
    [500, "Tente novamente"],
  ])("mapeia HTTP %s", (status, message) => {
    expect(
      messageForTransitionError(new ApiError({ status, code: "ERROR", message: "api" })),
    ).toContain(message);
  });

  it("preserva mensagem de regra 422 e trata rede", () => {
    expect(
      messageForTransitionError(
        new ApiError({ status: 422, code: "RULE", message: "Transição inválida" }),
      ),
    ).toBe("Transição inválida");
    expect(messageForTransitionError(new TypeError("network"))).toContain("conexão");
  });
});
