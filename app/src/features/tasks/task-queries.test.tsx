import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { tasksClient } from "./task-client";
import type { TaskCard } from "./task-contracts";
import { useTasks } from "./task-queries";

function task(companyId: string, title: string): TaskCard {
  return {
    id: `${companyId}-task`,
    companyId,
    requisitionId: null,
    title,
    description: null,
    priority: "MEDIUM",
    status: "TODO",
    assigneeId: null,
    startDate: null,
    plannedEndDate: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    assignee: null,
    requisition: null,
  };
}

function Probe({ companyId }: { companyId: string }) {
  const query = useTasks(companyId);
  if (query.isPending) return <span>loading</span>;
  if (query.isError) return <span>error</span>;
  if (query.data.length === 0) return <span>empty</span>;
  return <span>{query.data[0]?.title}</span>;
}

describe("task query hooks", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("expõe loading e success", async () => {
    let resolve: (data: TaskCard[]) => void = () => undefined;
    vi.spyOn(tasksClient, "list").mockReturnValue(new Promise((done) => (resolve = done)));
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Probe companyId="company-a" />
      </QueryClientProvider>,
    );
    expect(screen.getByText("loading")).toBeInTheDocument();
    resolve([task("company-a", "Tarefa A")]);
    expect(await screen.findByText("Tarefa A")).toBeInTheDocument();
  });

  it("expõe error sem retry automático para erro da API", async () => {
    const list = vi
      .spyOn(tasksClient, "list")
      .mockRejectedValue(new ApiError({ status: 403, code: "FORBIDDEN", message: "falha" }));
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Probe companyId="company-a" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("error")).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalledOnce());
  });

  it("não mistura resposta tardia de empresas diferentes", async () => {
    const pending = new Map<string, (data: TaskCard[]) => void>();
    vi.spyOn(tasksClient, "list").mockImplementation((companyId) => {
      return new Promise((resolve) => pending.set(companyId, resolve));
    });
    function SwitchingProbe() {
      const [companyId, setCompanyId] = useState("company-a");
      return (
        <>
          <button type="button" onClick={() => setCompanyId("company-b")}>
            trocar
          </button>
          <Probe companyId={companyId} />
        </>
      );
    }
    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <SwitchingProbe />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(pending.has("company-a")).toBe(true));
    screen.getByRole("button", { name: "trocar" }).click();
    await waitFor(() => expect(pending.has("company-b")).toBe(true));
    pending.get("company-a")?.([task("company-a", "Tarefa antiga")]);
    expect(screen.queryByText("Tarefa antiga")).not.toBeInTheDocument();
    pending.get("company-b")?.([task("company-b", "Tarefa atual")]);
    expect(await screen.findByText("Tarefa atual")).toBeInTheDocument();
    expect(screen.queryByText("Tarefa antiga")).not.toBeInTheDocument();
  });
});
