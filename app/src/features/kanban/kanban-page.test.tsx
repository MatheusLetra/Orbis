import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCard, TaskDetail } from "@/features/tasks/task-contracts";
import { useTaskDetail } from "@/features/tasks/task-queries";
import { KanbanPage } from "./kanban-page";

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: "user-1" } }),
}));

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
const capabilitiesState = {
  isPending: false,
  isError: false,
  isSuccess: false,
  data: undefined as { companyId: string; capabilities: { "tasks.create": boolean } } | undefined,
};
const detailState = {
  isPending: false,
  isError: false,
  data: null as TaskDetail | null,
  error: null as Error | null,
  refetch: vi.fn(),
};

vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => companyState,
}));
vi.mock("@/features/tasks/task-queries", () => ({
  useTasks: vi.fn(() => queryState),
  useTaskDetail: vi.fn(() => detailState),
}));
vi.mock("@/features/attachments/attachment-queries", () => ({
  useTaskAttachments: vi.fn(() => ({
    isPending: false,
    isError: false,
    data: [],
    error: null,
    refetch: vi.fn(),
  })),
}));
vi.mock("@/features/attachments/attachment-mutations", () => ({
  useUploadTaskFile: () => ({
    upload: vi.fn(),
    abort: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  }),
  useCreateTaskLink: () => ({
    create: vi.fn(),
    abort: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  }),
  useRemoveTaskAttachment: () => ({
    remove: vi.fn(),
    abort: vi.fn(),
    pending: {},
    errors: {},
    success: {},
  }),
}));
vi.mock("@/features/companies/capabilities-queries", () => ({
  useCompanyCapabilities: vi.fn(() => capabilitiesState),
}));
vi.mock("@/features/tasks/task-mutations", () => ({
  useTaskTransition: () => ({
    transition: vi.fn(),
    pendingTaskIds: new Set<string>(),
    error: null,
    clearError: vi.fn(),
  }),
  useCreateTask: () => ({
    create: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
    clearError: vi.fn(),
    reset: vi.fn(),
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
    capabilitiesState.isPending = false;
    capabilitiesState.isError = false;
    capabilitiesState.isSuccess = false;
    capabilitiesState.data = undefined;
    detailState.isPending = false;
    detailState.isError = false;
    detailState.data = null;
    detailState.error = null;
    detailState.refetch.mockReset();
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

  it("mostra Nova tarefa somente com tasks.create carregado", () => {
    capabilitiesState.data = { companyId: "company-a", capabilities: { "tasks.create": true } };
    capabilitiesState.isSuccess = true;
    const view = render(<KanbanPage />);
    expect(screen.getByRole("button", { name: "Nova tarefa" })).toBeEnabled();

    capabilitiesState.data = { companyId: "company-b", capabilities: { "tasks.create": false } };
    companyState.activeCompany = { id: "company-b", name: "Beta" };
    view.rerender(<KanbanPage />);
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();
  });

  it("não concede Nova tarefa durante loading ou erro de capabilities", () => {
    capabilitiesState.isPending = true;
    capabilitiesState.isSuccess = false;
    capabilitiesState.data = undefined;
    render(<KanbanPage />);
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();

    capabilitiesState.isPending = false;
    capabilitiesState.isError = true;
    render(<KanbanPage />);
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();
  });

  it("não chama detalhe no render inicial do board", () => {
    queryState.data = [task("task-alpha")];
    render(<KanbanPage />);
    expect(useTaskDetail).not.toHaveBeenCalled();
  });

  it("abre detalhe ao clicar em Ver detalhes e passa companyId/taskId", async () => {
    const user = userEvent.setup();
    queryState.data = [task("task-alpha")];
    detailState.data = {
      ...task("task-alpha"),
      history: [],
    };
    render(<KanbanPage />);
    await user.click(screen.getByRole("button", { name: /Ver detalhes da tarefa task-alpha/ }));
    await waitFor(() => expect(useTaskDetail).toHaveBeenCalledWith("company-a", "task-alpha"));
    expect(screen.getByRole("heading", { name: "Detalhes da tarefa" })).toBeInTheDocument();
  });

  it("fecha detalhe ao trocar de empresa", async () => {
    const user = userEvent.setup();
    queryState.data = [task("task-alpha")];
    detailState.data = {
      ...task("task-alpha"),
      history: [],
    };
    const view = render(<KanbanPage />);
    await user.click(screen.getByRole("button", { name: /Ver detalhes da tarefa task-alpha/ }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Detalhes da tarefa" })).toBeInTheDocument(),
    );
    companyState.activeCompany = { id: "company-b", name: "Beta" };
    queryState.data = [task("task-beta")];
    view.rerender(<KanbanPage />);
    expect(screen.queryByRole("heading", { name: "Detalhes da tarefa" })).not.toBeInTheDocument();
  });
});
