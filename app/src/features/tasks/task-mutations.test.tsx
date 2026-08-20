import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { timelineKeys } from "@/features/timeline/timeline-keys";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { tasksClient } from "./task-client";
import type { TaskCard, TaskOutput, TaskStatus } from "./task-contracts";
import { taskKeys } from "./task-keys";
import {
  messageForCreateError,
  messageForTransitionError,
  messageForUpdateError,
  useCreateTask,
  useTaskTransition,
  useUpdateTask,
} from "./task-mutations";

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
    expect(invalidate).toHaveBeenCalledWith({ queryKey: timelineKeys.weeklyLists("company-a") });
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

  it("não altera outro tenant e mantém isolamento durante transição válida", () => {
    const client = createQueryClient();
    client.setQueryData(taskKeys.list("company-a"), [task("task-a", "PAUSED")]);
    client.setQueryData(taskKeys.list("company-b"), [
      { ...task("task-a"), companyId: "company-b" },
    ]);
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
      ).toBe(true);
    });
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

  it("remove da lista filtrada e restaura na posição original no rollback", async () => {
    const client = createQueryClient();
    const key = taskKeys.list("company-a", { status: "TODO" });
    client.setQueryData(key, [task("before"), task("task-a"), task("after")]);
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
      expect(client.getQueryData<TaskCard[]>(key)?.map(({ id }) => id)).toEqual([
        "before",
        "after",
      ]),
    );
    request.reject(new ApiError({ status: 409, code: "CONFLICT", message: "stale" }));
    await waitFor(() =>
      expect(client.getQueryData<TaskCard[]>(key)?.map(({ id }) => id)).toEqual([
        "before",
        "task-a",
        "after",
      ]),
    );
  });

  it("não aplica rollback antigo sobre lista filtrada já substituída", async () => {
    const client = createQueryClient();
    const key = taskKeys.list("company-a", { status: "TODO" });
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
    await waitFor(() => expect(client.getQueryData<TaskCard[]>(key)).toEqual([]));
    const canonical = [task("server-task")];
    client.setQueryData(key, canonical);
    request.reject(new ApiError({ status: 409, code: "CONFLICT", message: "stale" }));
    await waitFor(() => expect(result.current.pendingTaskIds.size).toBe(0));
    expect(client.getQueryData(key)).toEqual(canonical);
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
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

describe("useCreateTask", () => {
  it("invalida somente as listas do tenant criado e bloqueia submit duplicado", async () => {
    const client = createQueryClient();
    const request = deferred<TaskOutput>();
    vi.spyOn(tasksClient, "create").mockReturnValue(request.promise);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateTask(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      expect(
        result.current.create({ companyId: "company-a", title: "Nova", priority: "MEDIUM" }),
      ).toBe(true);
      expect(
        result.current.create({ companyId: "company-a", title: "Duplicada", priority: "MEDIUM" }),
      ).toBe(false);
    });
    request.resolve({ ...output(task("created")), title: "Nova" });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskKeys.lists("company-a") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: timelineKeys.weeklyLists("company-a") });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: taskKeys.lists("company-b") });
    expect(client.getQueryData(timelineKeys.weekly("company-a", "2026-08-17"))).toBeUndefined();
  });

  it("preserva descrição e datas no payload legado da criação", async () => {
    const request = Promise.resolve({ ...output(task("created")), title: "Com datas" });
    const createSpy = vi.spyOn(tasksClient, "create").mockReturnValue(request);
    const { result } = renderHook(() => useCreateTask(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      result.current.create({
        companyId: "company-a",
        title: "Com datas",
        description: "Detalhes",
        priority: "HIGH",
        startDate: "2026-08-20",
        plannedEndDate: "2026-08-25",
      });
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(createSpy).toHaveBeenCalledWith("company-a", {
      title: "Com datas",
      description: "Detalhes",
      priority: "HIGH",
      assigneeId: undefined,
      requisitionId: undefined,
      startDate: "2026-08-20",
      plannedEndDate: "2026-08-25",
    });
  });

  it.each([
    [400, "Dados inválidos"],
    [403, "permissão"],
    [500, "Tente novamente"],
  ])("mapeia falha HTTP %s sem optimistic insert", async (status, message) => {
    const client = createQueryClient();
    vi.spyOn(tasksClient, "create").mockRejectedValue(
      new ApiError({ status, code: "ERROR", message: "Dados inválidos" }),
    );
    const { result } = renderHook(() => useCreateTask(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      result.current.create({ companyId: "company-a", title: "Nova", priority: "MEDIUM" });
    });
    await waitFor(() => expect(result.current.error).toContain(message));
    expect(client.getQueryData(taskKeys.list("company-a"))).toBeUndefined();
  });

  it("refaz capabilities e listas após 403", async () => {
    const client = createQueryClient();
    vi.spyOn(tasksClient, "create").mockRejectedValue(
      new ApiError({ status: 403, code: "FORBIDDEN", message: "negado" }),
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateTask(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    act(() => {
      result.current.create({ companyId: "company-a", title: "Nova", priority: "MEDIUM" });
    });
    await waitFor(() => expect(result.current.error).toContain("permissão"));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["company-capabilities", "company-a"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskKeys.lists("company-a") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: timelineKeys.weeklyLists("company-a") });
  });

  it("trata falha de rede sem apagar o formulário", () => {
    expect(messageForCreateError(new TypeError("network"))).toContain("conexão");
  });
});

describe("useUpdateTask", () => {
  it("envia uma vez, invalida somente o tenant e detalhe após sucesso", async () => {
    const client = createQueryClient();
    const request = deferred<TaskOutput>();
    vi.spyOn(tasksClient, "update").mockReturnValue(request.promise);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    act(() => {
      expect(
        result.current.update({
          companyId: "company-a",
          taskId: "task-a",
          title: "Novo",
          priority: "LOW",
        }),
      ).toBe(true);
      expect(
        result.current.update({
          companyId: "company-a",
          taskId: "task-a",
          title: "Outro",
          priority: "HIGH",
        }),
      ).toBe(false);
    });
    request.resolve(output(task("task-a")));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskKeys.lists("company-a") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: timelineKeys.weeklyLists("company-a") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskKeys.detail("company-a", "task-a") });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: taskKeys.lists("company-b") });
  });

  it.each([403, 404, 422, 500])("mapeia erro %s e mantém entrada", (status) => {
    const message = status === 422 ? "Título inválido" : "api";
    expect(messageForUpdateError(new ApiError({ status, code: "ERROR", message }))).toBeTruthy();
  });
  it("mapeia falha de rede", () =>
    expect(messageForUpdateError(new TypeError("network"))).toContain("conexão"));

  it("refaz capabilities, lista e detalhe após 403 e permite limpar/resetar", async () => {
    const client = createQueryClient();
    vi.spyOn(tasksClient, "update").mockRejectedValue(
      new ApiError({ status: 403, code: "FORBIDDEN", message: "negado" }),
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    act(() => {
      result.current.update({
        companyId: "company-a",
        taskId: "task-a",
        title: "Novo",
        priority: "HIGH",
      });
    });
    await waitFor(() => expect(result.current.error).toContain("permissão"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["company-capabilities", "company-a"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskKeys.lists("company-a") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskKeys.detail("company-a", "task-a") });
    act(() => {
      result.current.clearError();
      result.current.reset();
    });
    expect(result.current.error).toBeNull();
  });
});
