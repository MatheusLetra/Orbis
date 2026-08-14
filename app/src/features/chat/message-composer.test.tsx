import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageComposer } from "./message-composer";

const mutation = vi.hoisted(() => ({
  isPending: false,
  isSuccess: false,
  isError: false,
  send: vi.fn(() => true),
  reset: vi.fn(),
}));

vi.mock("./chat-mutations", () => ({ useSendMessage: () => mutation }));

describe("MessageComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutation.isPending = false;
    mutation.isSuccess = false;
    mutation.isError = false;
  });

  it("faz trim e envia com Enter, mas Shift+Enter cria nova linha", async () => {
    const user = userEvent.setup();
    render(<MessageComposer companyId="company-a" conversationId="conversation-a" />);
    const textarea = screen.getByRole("textbox", { name: "Mensagem" });
    await user.type(textarea, "  Olá  {shift>}{enter}{/shift}mundo");
    expect(textarea).toHaveValue("  Olá  \nmundo");
    await user.keyboard("{Enter}");
    expect(mutation.send).toHaveBeenCalledWith("Olá  \nmundo");
  });

  it("valida 1..5000, bloqueia pending e preserva conteúdo no erro", async () => {
    const user = userEvent.setup();
    const view = render(<MessageComposer companyId="company-a" conversationId="conversation-a" />);
    const textarea = screen.getByRole("textbox", { name: "Mensagem" });
    await user.type(textarea, "   ");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("entre 1 e 5000");
    expect(mutation.send).not.toHaveBeenCalled();

    await user.clear(textarea);
    await user.type(textarea, "mensagem preservada");
    mutation.isError = true;
    view.rerender(<MessageComposer companyId="company-a" conversationId="conversation-a" />);
    expect(textarea).toHaveValue("mensagem preservada");
    expect(screen.getByText(/mensagem foi preservada/)).toBeInTheDocument();

    mutation.isPending = true;
    view.rerender(<MessageComposer companyId="company-a" conversationId="conversation-a" />);
    expect(textarea).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviando..." })).toBeDisabled();
  });

  it("rejeita mensagem acima de 5000 caracteres e anuncia a contagem", async () => {
    render(<MessageComposer companyId="company-a" conversationId="conversation-a" />);
    const textarea = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(textarea, { target: { value: "a".repeat(5001) } });
    expect(screen.getByText("5001/5000")).toBeInTheDocument();
    fireEvent.submit(textarea.closest("form") as HTMLFormElement);
    expect(screen.getByRole("alert")).toHaveTextContent("entre 1 e 5000");
    expect(mutation.send).not.toHaveBeenCalled();
  });

  it("limpa somente após sucesso canônico e mantém Enter bloqueado durante pending", async () => {
    const user = userEvent.setup();
    const view = render(<MessageComposer companyId="company-a" conversationId="conversation-a" />);
    const textarea = screen.getByRole("textbox", { name: "Mensagem" });
    await user.type(textarea, "Mensagem válida");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(mutation.reset).toHaveBeenCalled();
    expect(mutation.send).toHaveBeenCalledWith("Mensagem válida");
    expect(textarea).toHaveValue("Mensagem válida");

    mutation.isSuccess = true;
    view.rerender(<MessageComposer companyId="company-a" conversationId="conversation-a" />);
    expect(textarea).toHaveValue("");
    expect(mutation.reset).toHaveBeenCalledTimes(2);

    mutation.isSuccess = false;
    mutation.isPending = true;
    view.rerender(<MessageComposer companyId="company-a" conversationId="conversation-a" />);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(mutation.send).toHaveBeenCalledOnce();
  });
});
