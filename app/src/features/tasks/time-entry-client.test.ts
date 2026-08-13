import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { timeEntriesClient } from "./time-entry-client";

describe("time entries client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("usa endpoint codificado e não envia limit por padrão", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({
      items: [],
      totalDurationMinutes: 0,
      hasMore: false,
    });
    await timeEntriesClient.listForTask("company/a", "task/b");
    expect(request).toHaveBeenCalledWith("/companies/company%2Fa/tasks/task%2Fb/time-entries", {
      signal: undefined,
    });
  });

  it("envia limit explícito e repassa AbortSignal", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({
      items: [],
      totalDurationMinutes: 0,
      hasMore: false,
    });
    const signal = new AbortController().signal;
    await timeEntriesClient.listForTask("company-a", "task-a", { limit: 25, signal });
    expect(request).toHaveBeenCalledWith(
      "/companies/company-a/tasks/task-a/time-entries?limit=25",
      { signal },
    );
  });

  it("cria apontamento com IDs codificados e descrição trimada", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(buildEntry());
    const signal = new AbortController().signal;
    await timeEntriesClient.createForTask(
      "company/a",
      "task/b",
      { durationMinutes: 90, description: "  Implementação  " },
      { signal },
    );
    expect(request).toHaveBeenCalledWith("/companies/company%2Fa/tasks/task%2Fb/time-entries", {
      method: "POST",
      body: { durationMinutes: 90, description: "Implementação" },
      signal,
    });
  });

  it("omite descrição ausente ou vazia", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(buildEntry());
    await timeEntriesClient.createForTask("company-a", "task-a", {
      durationMinutes: 1,
      description: "   ",
    });
    expect(request).toHaveBeenCalledWith("/companies/company-a/tasks/task-a/time-entries", {
      method: "POST",
      body: { durationMinutes: 1 },
      signal: undefined,
    });
  });

  it("valida a resposta de criação", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue({ invalid: true });
    await expect(
      timeEntriesClient.createForTask("company-a", "task-a", { durationMinutes: 10 }),
    ).rejects.toThrow("Contrato de apontamento inválido");
  });
});

function buildEntry() {
  return {
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
}
