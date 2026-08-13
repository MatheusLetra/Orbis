import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TaskCard as TaskCardData } from "@/features/tasks/task-contracts";
import { createQueryClient } from "@/lib/query/query-client";
import { TaskCard } from "./task-card";

const baseTask: TaskCardData = {
  id: "task-1",
  companyId: "company-a",
  requisitionId: null,
  title: "Uma tarefa com um título bastante longo que precisa continuar legível em mobile",
  description: null,
  priority: "HIGH",
  status: "TODO",
  assigneeId: null,
  startDate: null,
  plannedEndDate: null,
  completedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  assignee: { id: "user-1", name: "Ana" },
  requisition: { id: "req-1", number: 42, title: "Melhoria de acesso" },
};

describe("TaskCard", () => {
  it("exibe título, prioridade, responsável e Requisition", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByRole("heading", { name: baseTask.title })).toBeInTheDocument();
    expect(screen.getByText("Prioridade Alta")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("#42 · Melhoria de acesso")).toBeInTheDocument();
  });

  it("trata relações nulas explicitamente", () => {
    render(<TaskCard task={{ ...baseTask, assignee: null, requisition: null, priority: "LOW" }} />);
    expect(screen.getByText("Sem responsável")).toBeInTheDocument();
    expect(screen.getByText("Sem Requisition")).toBeInTheDocument();
    expect(screen.getByText("Prioridade Baixa")).toBeInTheDocument();
  });

  it.each([
    ["TODO", ["Iniciar"]],
    ["IN_PROGRESS", ["Pausar", "Concluir"]],
    ["PAUSED", ["Retomar"]],
    ["DONE", []],
  ] as const)("oferece ações válidas para %s", (status, labels) => {
    render(
      <TaskCard
        task={{ ...baseTask, status, completedAt: status === "DONE" ? "2026-01-02" : null }}
      />,
    );
    for (const label of labels)
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    if (status === "PAUSED")
      expect(screen.queryByRole("button", { name: /Concluir/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver detalhes/ })).toBeInTheDocument();
    if (status === "DONE") {
      expect(screen.queryByRole("button", { name: /Mover tarefa/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Editar tarefa/ })).not.toBeInTheDocument();
    }
  });

  it("executa ação rápida e comunica pending", async () => {
    const onTransition = vi.fn();
    const user = userEvent.setup();
    const view = render(<TaskCard task={baseTask} onTransition={onTransition} />);
    await user.click(screen.getByRole("button", { name: /Iniciar tarefa/ }));
    expect(onTransition).toHaveBeenCalledWith(baseTask, "IN_PROGRESS");

    view.rerender(<TaskCard task={baseTask} pending onTransition={onTransition} />);
    expect(screen.getByRole("status")).toHaveTextContent("Atualizando tarefa");
    expect(screen.getByRole("button", { name: /Iniciar tarefa/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Mover tarefa/ })).toBeDisabled();
  });

  it("exibe edição somente quando autorizada e nunca para DONE", () => {
    const { rerender } = render(
      <QueryClientProvider client={createQueryClient()}>
        <TaskCard task={baseTask} canEdit companyId="company-a" />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: /Editar tarefa/ })).toBeInTheDocument();
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <TaskCard task={{ ...baseTask, status: "DONE" }} canEdit={false} companyId="company-a" />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: /Editar tarefa/ })).not.toBeInTheDocument();
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <TaskCard task={baseTask} canEdit={false} companyId="company-a" />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: /Editar tarefa/ })).not.toBeInTheDocument();
  });
});
