import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { membersClient } from "@/features/members/members-client";
import { createQueryClient } from "@/lib/query/query-client";
import { QuickTaskDialog } from "./quick-task-dialog";

const create = vi.fn();
const reset = vi.fn();
const clearError = vi.fn();
const mutationState = {
  isPending: false,
  isSuccess: false,
  error: null as string | null,
};

vi.mock("@/features/tasks/task-mutations", () => ({
  useCreateTask: () => ({ ...mutationState, create, reset, clearError }),
}));

function renderDialog(canCreate = true) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <QuickTaskDialog companyId="company-a" canCreate={canCreate} />
    </QueryClientProvider>,
  );
}

describe("QuickTaskDialog", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mutationState.isPending = false;
    mutationState.isSuccess = false;
    mutationState.error = null;
  });
  afterEach(() => vi.restoreAllMocks());

  it("oculta a ação sem tasks.create e abre com foco no título", async () => {
    const user = userEvent.setup();
    renderDialog(false);
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();

    cleanup();
    renderDialog(true);
    const trigger = screen.getByRole("button", { name: "Nova tarefa" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Título")).toHaveFocus());
  });

  it("mantém header, main, footer e foco contido no layout responsivo", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    const modal = screen.getByRole("dialog", { name: "Nova tarefa" });
    const backdrop = screen.getByTestId("responsive-dialog-backdrop");
    expect(modal).toHaveClass("responsive-dialog-modal");
    expect(modal.querySelector("header")).toBeInTheDocument();
    expect(modal.querySelector("main")).toHaveClass("responsive-dialog-main");
    expect(modal.querySelector("footer")).toHaveClass("responsive-dialog-footer");
    expect(backdrop).toHaveStyle({
      width: `${window.innerWidth}px`,
      height: `${window.innerHeight}px`,
    });
    await waitFor(() => expect(screen.getByLabelText("Título")).toHaveFocus());
    screen.getByRole("button", { name: "Criar tarefa" }).focus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getByLabelText("Título")).toHaveFocus();
  });

  it("valida título, envia prioridade MEDIUM e restaura foco após Escape", async () => {
    const user = userEvent.setup();
    renderDialog();
    const trigger = screen.getByRole("button", { name: "Nova tarefa" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(screen.getByText("Informe um título para a tarefa.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Título"), "  Tarefa rápida  ");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Nova tarefa" })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(create).toHaveBeenCalledWith({
      companyId: "company-a",
      title: "Tarefa rápida",
      priority: "MEDIUM",
    });
  });

  it("preserva o formulário durante pending e fecha/limpa após sucesso", async () => {
    const user = userEvent.setup();
    const view = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.type(screen.getByLabelText("Título"), "Tarefa pendente");
    mutationState.isPending = true;
    view.rerender(
      <QueryClientProvider client={createQueryClient()}>
        <QuickTaskDialog companyId="company-a" canCreate />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Criando..." }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Tarefa pendente")).toBeInTheDocument();

    mutationState.isPending = false;
    mutationState.isSuccess = true;
    view.rerender(
      <QueryClientProvider client={createQueryClient()}>
        <QuickTaskDialog companyId="company-a" canCreate />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(reset).toHaveBeenCalled());
  });

  it("permite associar responsável e Requisition pelo nome", async () => {
    const user = userEvent.setup();
    render(
      <QuickTaskDialog
        companyId="company-a"
        canCreate
        members={[{ userId: "user-a", name: "Ana" }]}
        requisitions={[{ id: "req-a", number: 7, title: "Entrega" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.type(screen.getByLabelText("Título"), "Associada");
    await user.selectOptions(screen.getByLabelText("Responsável"), "user-a");
    await user.selectOptions(screen.getByLabelText("Requisition"), "req-a");
    await user.type(screen.getByLabelText("Descrição"), "Detalhes");
    await user.type(screen.getByLabelText("Data de início"), "2026-08-20");
    await user.type(screen.getByLabelText("Previsão de término"), "2026-08-25");
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeId: "user-a",
        requisitionId: "req-a",
        description: "Detalhes",
        startDate: "2026-08-20",
        plannedEndDate: "2026-08-25",
      }),
    );
  });

  it("usa a busca server-side de membros quando users.read está habilitado", async () => {
    const user = userEvent.setup();
    const list = vi
      .spyOn(membersClient, "list")
      .mockResolvedValue([{ userId: "user-a", name: "Ana" }]);
    render(
      <QueryClientProvider client={createQueryClient()}>
        <QuickTaskDialog
          companyId="company-a"
          canCreate
          enableMemberLookup
          enableRequisitionLookup
          members={[{ userId: "user-a", name: "Ana" }]}
        />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.click(screen.getByRole("button", { name: "Buscar responsável" }));
    await user.click(await screen.findByRole("option", { name: "Ana" }));
    expect(screen.getByRole("button", { name: "Buscar requisition" })).toBeEnabled();
    await user.type(screen.getByLabelText("Título"), "Com lookup");
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(list).toHaveBeenCalledWith(
      "company-a",
      { search: "" },
      { signal: expect.any(AbortSignal) },
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: "user-a", title: "Com lookup" }),
    );
  });

  it("associa a mensagem de erro ao título e preserva valores", async () => {
    const user = userEvent.setup();
    mutationState.error = "Não foi possível criar a tarefa.";
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.type(screen.getByLabelText("Título"), "Preservar");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "quick-task-error");
    expect(screen.getByLabelText("Título")).toHaveAttribute("aria-describedby", "quick-task-error");
    expect(screen.getByDisplayValue("Preservar")).toBeInTheDocument();
  });
});
