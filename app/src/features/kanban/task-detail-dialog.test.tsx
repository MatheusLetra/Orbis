import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCard, TaskDetail } from "@/features/tasks/task-contracts";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { TaskDetailDialog } from "./task-detail-dialog";

const task: TaskCard = {
  id: "task-1",
  companyId: "company-a",
  requisitionId: null,
  title: "Tarefa de teste",
  description: "Descrição da tarefa",
  priority: "HIGH",
  status: "DONE",
  assigneeId: "user-1",
  startDate: null,
  plannedEndDate: null,
  completedAt: "2026-02-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  assignee: { id: "user-1", name: "Ana" },
  requisition: null,
};

const detail: TaskDetail = {
  ...task,
  history: [
    {
      id: "hist-1",
      taskId: "task-1",
      fromStatus: null,
      toStatus: "TODO",
      changedBy: "user-1",
      changedAt: "2026-01-01T00:00:00.000Z",
      metadata: null,
    },
    {
      id: "hist-2",
      taskId: "task-1",
      fromStatus: "TODO",
      toStatus: "DONE",
      changedBy: "user-1",
      changedAt: "2026-02-01T00:00:00.000Z",
      metadata: null,
    },
  ],
};

const queryState = {
  isPending: false,
  isError: false,
  data: null as TaskDetail | null,
  error: null as Error | null,
  refetch: vi.fn(),
};

vi.mock("@/features/tasks/task-queries", () => ({
  useTaskDetail: () => ({ ...queryState }),
}));

function renderDialog(props: Partial<React.ComponentProps<typeof TaskDetailDialog>> = {}) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <TaskDetailDialog
        companyId="company-a"
        task={task}
        isOpen={true}
        onClose={vi.fn()}
        {...props}
      />
      ,
    </QueryClientProvider>,
  );
}

describe("TaskDetailDialog", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    queryState.isPending = false;
    queryState.isError = false;
    queryState.data = null;
    queryState.error = null;
  });

  it("renderiza loading enquanto carrega", () => {
    queryState.isPending = true;
    renderDialog();
    expect(screen.getByText("Carregando detalhes...")).toBeInTheDocument();
  });

  it("exibe campos e histórico após carregamento", async () => {
    queryState.data = detail;
    renderDialog();
    expect(screen.getByText("Tarefa de teste")).toBeInTheDocument();
    expect(screen.getByText("Descrição da tarefa")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getByText(/Criação/)).toBeInTheDocument();
    expect(screen.getAllByText(/A fazer/)).toHaveLength(2);
  });

  it("exibe estado vazio quando não há task selecionada", () => {
    renderDialog({ task: null });
    expect(screen.getByText("Nenhuma tarefa selecionada")).toBeInTheDocument();
  });

  it("foca no título ao abrir e fecha com Escape restaurando foco", async () => {
    const user = userEvent.setup();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    queryState.data = detail;
    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Detalhes da tarefa" })).toHaveFocus(),
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    document.body.removeChild(trigger);
  });

  it("trata erro 403", () => {
    queryState.isError = true;
    queryState.error = new ApiError({ status: 403, code: "FORBIDDEN", message: "negado" });
    renderDialog();
    expect(screen.getByText(/permissão/)).toBeInTheDocument();
  });

  it("trata erro 404", () => {
    queryState.isError = true;
    queryState.error = new ApiError({ status: 404, code: "NOT_FOUND", message: "não encontrada" });
    renderDialog();
    expect(screen.getByText(/não foi encontrada/)).toBeInTheDocument();
  });

  it("trata erro de rede/5xx", () => {
    queryState.isError = true;
    queryState.error = new TypeError("network");
    renderDialog();
    expect(screen.getByText(/conexão/)).toBeInTheDocument();
  });

  it("chama refetch ao clicar em Tentar novamente", async () => {
    const user = userEvent.setup();
    queryState.isError = true;
    queryState.error = new ApiError({ status: 500, code: "ERROR", message: "erro" });
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
  });
});
