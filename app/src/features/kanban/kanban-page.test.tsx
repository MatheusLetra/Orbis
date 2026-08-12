import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { KanbanPage } from "./kanban-page";

const companyState = {
  status: "ready" as "ready" | "idle" | "loading" | "error",
  activeCompany: { id: "company-a", name: "Alpha" } as { id: string; name: string } | null,
  companies: [{ id: "company-a", name: "Alpha" }],
};
const queryState = {
  isPending: false,
  isError: false,
  data: [] as TaskCard[],
  refetch: vi.fn(),
};

vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => companyState,
}));
vi.mock("@/features/tasks/task-queries", () => ({
  useTasks: vi.fn(() => queryState),
}));
vi.mock("@/features/tasks/task-mutations", () => ({
  useTaskTransition: () => ({
    transition: vi.fn(),
    pendingTaskIds: new Set<string>(),
    error: null,
    clearError: vi.fn(),
  }),
}));
vi.mock("@/app/layouts/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

function task(id: string): TaskCard {
  return {
    id,
    companyId: "company-a",
    requisitionId: null,
    title: id,
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

describe("KanbanPage", () => {
  beforeEach(() => {
    companyState.status = "ready";
    companyState.activeCompany = { id: "company-a", name: "Alpha" };
    queryState.isPending = false;
    queryState.isError = false;
    queryState.data = [];
    queryState.refetch.mockReset();
  });

  it("não executa query tenant-aware sem empresa ativa", async () => {
    const { useTasks } = await import("@/features/tasks/task-queries");
    companyState.activeCompany = null;
    render(<KanbanPage />);
    expect(screen.getByText("Carregando empresa ativa...")).toBeInTheDocument();
    expect(useTasks).toHaveBeenCalledWith(null);
  });

  it("usa a empresa ativa, mostra loading e board vazio", () => {
    queryState.isPending = true;
    render(<KanbanPage />);
    expect(screen.getByText("Carregando tarefas...")).toBeInTheDocument();
    expect(screen.getByText("Tarefas · Alpha")).toBeInTheDocument();

    queryState.isPending = false;
    render(<KanbanPage />);
    expect(screen.getByText("Nenhuma tarefa ainda")).toBeInTheDocument();
  });

  it("mostra erro e permite retry da query", async () => {
    queryState.isError = true;
    render(<KanbanPage />);
    await act(async () => screen.getByRole("button", { name: "Tentar novamente" }).click());
    expect(queryState.refetch).toHaveBeenCalledOnce();
  });

  it("renderiza dados da nova empresa sem apresentar o tenant anterior", () => {
    queryState.data = [task("task-alpha")];
    const view = render(<KanbanPage />);
    expect(screen.getByText("task-alpha")).toBeInTheDocument();
    expect(screen.queryByText("task-beta")).not.toBeInTheDocument();
    companyState.activeCompany = { id: "company-b", name: "Beta" };
    queryState.data = [task("task-beta")];
    view.rerender(<KanbanPage />);
    expect(screen.getByText("task-beta")).toBeInTheDocument();
    expect(screen.queryByText("task-alpha")).not.toBeInTheDocument();
  });
});
