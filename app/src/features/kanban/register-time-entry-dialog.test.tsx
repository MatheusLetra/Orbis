import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyCapabilities } from "@/features/companies/capabilities-contracts";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { ApiError } from "@/lib/http/api-error";
import { canRegisterTimeEntry, RegisterTimeEntryDialog } from "./register-time-entry-dialog";

const mutationState = vi.hoisted(() => ({
  register: vi.fn(() => true),
  abort: vi.fn(),
  clearError: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isSuccess: false,
  error: null as Error | null,
  options: null as {
    onSuccess?: (output: unknown) => void;
    onError?: (error: Error) => void;
  } | null,
}));

vi.mock("@/features/tasks/time-entry-mutations", () => ({
  useRegisterTimeEntry: vi.fn(
    (_companyId: string, _taskId: string, options: typeof mutationState.options) => {
      mutationState.options = options;
      return mutationState;
    },
  ),
}));

const task: TaskCard = {
  id: "task-a",
  companyId: "company-a",
  requisitionId: null,
  title: "Task A",
  description: null,
  priority: "MEDIUM",
  status: "DONE",
  assigneeId: "user-a",
  startDate: null,
  plannedEndDate: null,
  completedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  assignee: { id: "user-a", name: "Ana" },
  requisition: null,
};

const capabilities: CompanyCapabilities = {
  companyId: "company-a",
  capabilities: {
    "tasks.create": false,
    "tasks.update": false,
    "kanban.manage": false,
    "hours.register": true,
    "users.read": false,
    "requisitions.read": false,
  },
};

describe("canRegisterTimeEntry", () => {
  it("permite Task própria e DONE", () => {
    expect(canRegisterTimeEntry(task, capabilities, "company-a", "user-a", true)).toBe(true);
  });

  it("exige kanban.manage para Task de terceiro e bloqueia sem assignee", () => {
    expect(
      canRegisterTimeEntry({ assigneeId: "user-b" }, capabilities, "company-a", "user-a", true),
    ).toBe(false);
    expect(
      canRegisterTimeEntry(
        { assigneeId: "user-b" },
        {
          ...capabilities,
          capabilities: { ...capabilities.capabilities, "kanban.manage": true },
        },
        "company-a",
        "user-a",
        true,
      ),
    ).toBe(true);
    expect(
      canRegisterTimeEntry({ assigneeId: null }, capabilities, "company-a", "user-a", true),
    ).toBe(false);
    expect(
      canRegisterTimeEntry(
        { assigneeId: null },
        {
          ...capabilities,
          capabilities: { ...capabilities.capabilities, "kanban.manage": true },
        },
        "company-a",
        "user-a",
        true,
      ),
    ).toBe(true);
  });

  it("exige hours.register, usuário e companyId correspondente", () => {
    expect(
      canRegisterTimeEntry(
        task,
        { ...capabilities, companyId: "company-b" },
        "company-a",
        "user-a",
        true,
      ),
    ).toBe(false);
    expect(
      canRegisterTimeEntry(
        task,
        {
          ...capabilities,
          capabilities: { ...capabilities.capabilities, "hours.register": false },
        },
        "company-a",
        "user-a",
        true,
      ),
    ).toBe(false);
    expect(canRegisterTimeEntry(task, undefined, "company-a", "user-a", true)).toBe(false);
    expect(canRegisterTimeEntry(task, capabilities, "company-a", "user-a", false)).toBe(false);
  });
});

describe("RegisterTimeEntryDialog", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mutationState.isPending = false;
    mutationState.isSuccess = false;
    mutationState.error = null;
    mutationState.options = null;
  });

  function renderDialog(canRegister = true, isOpen = true) {
    return render(
      <RegisterTimeEntryDialog
        companyId="company-a"
        task={task}
        isOpen={isOpen}
        canRegister={canRegister}
        onCapabilitiesForbidden={vi.fn()}
      />,
    );
  }

  it("oculta o botão quando o predicate não concede acesso", () => {
    renderDialog(false);
    expect(screen.queryByRole("button", { name: /Registrar horas/ })).not.toBeInTheDocument();
  });

  it("abre com foco, fecha com Escape e restaura foco", async () => {
    const user = userEvent.setup();
    renderDialog();
    const trigger = screen.getByRole("button", { name: "Registrar horas na tarefa Task A" });
    trigger.focus();
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Registrar horas" });
    await waitFor(() => expect(screen.getByLabelText("Duração (minutos)")).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(mutationState.abort).toHaveBeenCalled();
  });

  it("mantém Tab e Shift+Tab dentro do submodal", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    const first = screen.getByLabelText("Duração (minutos)");
    const last = submitButton();
    await waitFor(() => expect(first).toHaveFocus());
    last.focus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    screen.getByRole("button", { name: "Fechar" }).focus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(last).toHaveFocus();
  });

  it.each([320, 360, 375, 390])("mantém o submodal dentro de %spx", (viewportWidth) => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    const backdrop = screen.getByTestId("register-time-entry-backdrop");
    const dialog = screen.getByRole("dialog", { name: "Registrar horas" });
    const horizontalPadding = Number.parseFloat(getComputedStyle(backdrop).paddingLeft) * 2;
    expect(dialog).toHaveClass("register-time-entry-modal");
    expect(getComputedStyle(dialog).maxWidth).toBe("512px");
    expect(viewportWidth - horizontalPadding).toBeLessThanOrEqual(viewportWidth);
  });

  it.each([
    ["0", "A duração mínima é de 1 minuto."],
    ["-1", "A duração mínima é de 1 minuto."],
    ["1.5", "Informe um número inteiro de minutos."],
    ["1441", "A duração máxima é de 1440 minutos."],
  ])("valida duração %s", async (value, message) => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    await user.type(screen.getByLabelText("Duração (minutos)"), value);
    await user.click(submitButton());
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(mutationState.register).not.toHaveBeenCalled();
  });

  it.each(["1", "1440"])("aceita o limite válido %s", async (value) => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    await user.type(screen.getByLabelText("Duração (minutos)"), value);
    await user.click(submitButton());
    expect(mutationState.register).toHaveBeenCalledWith({ durationMinutes: Number(value) });
  });

  it("envia duração e descrição trimada, omitindo descrição vazia", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    await user.type(screen.getByLabelText("Duração (minutos)"), "90");
    await user.type(screen.getByLabelText("Descrição (opcional)"), "  Revisão  ");
    await user.click(submitButton());
    expect(mutationState.register).toHaveBeenCalledWith({
      durationMinutes: 90,
      description: "Revisão",
    });
  });

  it("rejeita descrição acima de 1000 caracteres", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    await user.type(screen.getByLabelText("Duração (minutos)"), "10");
    fireEvent.change(screen.getByLabelText("Descrição (opcional)"), {
      target: { value: "x".repeat(1001) },
    });
    await user.click(submitButton());
    expect(screen.getByRole("alert")).toHaveTextContent(/no máximo 1000/);
    expect(mutationState.register).not.toHaveBeenCalled();
  });

  it("preserva valores, permite retry e refaz capabilities em 403", async () => {
    const user = userEvent.setup();
    const onForbidden = vi.fn();
    const view = render(
      <RegisterTimeEntryDialog
        companyId="company-a"
        task={task}
        isOpen
        canRegister
        onCapabilitiesForbidden={onForbidden}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    const duration = screen.getByLabelText("Duração (minutos)");
    const description = screen.getByLabelText("Descrição (opcional)");
    await user.type(duration, "45");
    await user.type(description, "Contexto");
    mutationState.error = new ApiError({ status: 403, code: "FORBIDDEN", message: "negado" });
    mutationState.options?.onError?.(mutationState.error);
    view.rerender(
      <RegisterTimeEntryDialog
        companyId="company-a"
        task={task}
        isOpen
        canRegister
        onCapabilitiesForbidden={onForbidden}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/permissão/);
    expect(duration).toHaveValue(45);
    expect(description).toHaveValue("Contexto");
    expect(onForbidden).toHaveBeenCalledOnce();
    await user.click(submitButton());
    expect(mutationState.register).toHaveBeenCalledWith({
      durationMinutes: 45,
      description: "Contexto",
    });
  });

  it("desabilita controles durante pending", async () => {
    const user = userEvent.setup();
    mutationState.isPending = true;
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    expect(screen.getByLabelText("Duração (minutos)")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Registrando horas");
  });

  it("fecha e limpa somente após sucesso confirmado", async () => {
    const user = userEvent.setup();
    renderDialog();
    const trigger = screen.getByRole("button", { name: "Registrar horas na tarefa Task A" });
    await user.click(trigger);
    await user.type(screen.getByLabelText("Duração (minutos)"), "30");
    const dialog = screen.getByRole("dialog", { name: "Registrar horas" });
    act(() => mutationState.options?.onSuccess?.({}));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    expect(screen.getByLabelText("Duração (minutos)")).toHaveValue(null);
    expect(mutationState.reset).toHaveBeenCalled();
  });

  it("fecha e aborta quando o detalhe fecha, ignorando sucesso stale", async () => {
    const user = userEvent.setup();
    const view = renderDialog();
    await user.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    const duration = screen.getByLabelText("Duração (minutos)");
    await user.type(duration, "30");
    const staleSuccess = mutationState.options?.onSuccess;

    view.rerender(
      <RegisterTimeEntryDialog companyId="company-a" task={task} isOpen={false} canRegister />,
    );

    expect(mutationState.abort).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Registrar horas" })).not.toBeInTheDocument();
    act(() => staleSuccess?.({}));
    expect(duration).toHaveValue(30);
    expect(mutationState.reset).not.toHaveBeenCalled();
  });

  it("aborta ao trocar a Task sem aplicar resposta da Task anterior", async () => {
    const user = userEvent.setup();
    const view = renderDialog();
    await user.click(screen.getByRole("button", { name: "Registrar horas na tarefa Task A" }));
    const duration = screen.getByLabelText("Duração (minutos)");
    await user.type(duration, "20");
    const staleSuccess = mutationState.options?.onSuccess;
    const nextTask = { ...task, id: "task-b", title: "Task B" };

    view.rerender(
      <RegisterTimeEntryDialog companyId="company-a" task={nextTask} isOpen canRegister />,
    );

    expect(mutationState.abort).toHaveBeenCalled();
    act(() => staleSuccess?.({}));
    expect(
      screen.getByRole("button", { name: "Registrar horas na tarefa Task B" }),
    ).toBeInTheDocument();
  });
});

function submitButton(): HTMLElement {
  const buttons = screen.getAllByRole("button", { name: "Registrar horas" });
  const button = buttons.at(-1);
  if (!button) throw new Error("Botão de submissão não encontrado");
  return button;
}
