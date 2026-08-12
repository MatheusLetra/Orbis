import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { tasksClient } from "./task-client";

describe("tasks client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("monta listagem default e filtros combinados", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await tasksClient.list("company/a");
    expect(request).toHaveBeenCalledWith("/companies/company%2Fa/tasks?scope=company", undefined);
    await tasksClient.list("company-a", {
      scope: "own",
      status: "TODO",
      priority: "LOW",
      assigneeId: "user-a",
      requisitionId: "req-a",
      search: "  a&b  ",
    });
    expect(request).toHaveBeenLastCalledWith(
      "/companies/company-a/tasks?scope=own&status=TODO&priority=LOW&assigneeId=user-a&requisitionId=req-a&search=a%26b",
      undefined,
    );
  });

  it("prepara detail, create, update e transition", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({});
    await tasksClient.detail("company-a", "task-a");
    await tasksClient.create("company-a", { title: "Nova" });
    await tasksClient.update("company-a", "task-a", { title: "Atualizada" });
    await tasksClient.transition("company-a", "task-a", "DONE");
    expect(request).toHaveBeenNthCalledWith(1, "/companies/company-a/tasks/task-a", undefined);
    expect(request).toHaveBeenNthCalledWith(2, "/companies/company-a/tasks", {
      method: "POST",
      body: { title: "Nova" },
    });
    expect(request).toHaveBeenNthCalledWith(4, "/companies/company-a/tasks/task-a/status", {
      method: "PATCH",
      body: { status: "DONE" },
    });
  });

  it("repassa AbortSignal na listagem", async () => {
    const signal = new AbortController().signal;
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await tasksClient.list("company-a", {}, { signal });
    expect(request).toHaveBeenCalledWith("/companies/company-a/tasks?scope=company", { signal });
  });
});
