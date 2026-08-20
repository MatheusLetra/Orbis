import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { createQueryClient } from "@/lib/query/query-client";
import { EditTaskDialog } from "./edit-task-dialog";

const update = vi.fn();
const clearError = vi.fn();
const reset = vi.fn();
const state = { isPending: false, isSuccess: false, error: null as string | null };

vi.mock("@/features/tasks/task-mutations", () => ({
  useUpdateTask: () => ({ ...state, update, clearError, reset }),
}));

const task: TaskCard = {
  id: "task-1",
  companyId: "company-a",
  requisitionId: null,
  title: "Título atual",
  description: null,
  priority: "HIGH",
  status: "TODO",
  assigneeId: "user-1",
  startDate: null,
  plannedEndDate: null,
  completedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  assignee: { id: "user-1", name: "Ana" },
  requisition: null,
};

function renderDialog() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <EditTaskDialog companyId="company-a" task={task} />
    </QueryClientProvider>,
  );
}

describe("EditTaskDialog", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    state.isPending = false;
    state.isSuccess = false;
    state.error = null;
  });

  it("abre com valores atuais, valida título e restaura foco no Escape", async () => {
    const user = userEvent.setup();
    renderDialog();
    const trigger = screen.getByRole("button", { name: /Editar tarefa/ });
    await user.click(trigger);
    expect(screen.getByDisplayValue("Título atual")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alta")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Título"));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(screen.getByText("Informe um título para a tarefa.")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Título"), "Novo título");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("mantém o formulário longo em main rolável e footer acessível", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: /Editar tarefa/ }));
    const modal = screen.getByRole("dialog", { name: "Editar tarefa" });
    expect(modal).toHaveClass("responsive-dialog-modal");
    expect(modal.querySelector("main")).toHaveClass("responsive-dialog-main");
    expect(modal.querySelector("footer")).toHaveClass("responsive-dialog-footer");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });

  it("envia title e priority e bloqueia segundo submit durante pending", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: /Editar tarefa/ }));
    await user.clear(screen.getByLabelText("Título"));
    await user.type(screen.getByLabelText("Título"), "Editada");
    await user.selectOptions(screen.getByLabelText("Prioridade"), "LOW");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(update).toHaveBeenCalledWith({
      companyId: "company-a",
      taskId: "task-1",
      title: "Editada",
      priority: "LOW",
      assigneeId: "user-1",
      requisitionId: null,
    });
    state.isPending = true;
    cleanup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: /Editar tarefa/ }));
    expect(screen.getByRole("button", { name: /Salvando/ })).toBeDisabled();
  });

  it("preserva valores e erro da mutation", async () => {
    const user = userEvent.setup();
    state.error = "Você não tem permissão para editar esta tarefa.";
    renderDialog();
    await user.click(screen.getByRole("button", { name: /Editar tarefa/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("permissão");
    expect(screen.getByDisplayValue("Título atual")).toBeInTheDocument();
  });

  it("permite alterar responsável e Requisition", async () => {
    const user = userEvent.setup();
    render(
      <EditTaskDialog
        companyId="company-a"
        task={task}
        members={[{ userId: "user-2", name: "Bruno" }]}
        requisitions={[{ id: "req-b", number: 8, title: "Correção" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Editar tarefa/ }));
    await user.selectOptions(screen.getByLabelText("Responsável"), "user-2");
    await user.selectOptions(screen.getByLabelText("Requisition"), "req-b");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: "user-2", requisitionId: "req-b" }),
    );
  });
});
