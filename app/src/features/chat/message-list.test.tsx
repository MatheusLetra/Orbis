import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { message } from "./chat-test-fixtures";
import { MessageList } from "./message-list";

describe("MessageList", () => {
  it("renderiza XSS e conteúdo longo como texto e carrega anteriores uma vez", async () => {
    const user = userEvent.setup();
    const load = vi.fn();
    const malicious = `<img src=x onerror="alert(1)">${"a".repeat(1000)}`;
    const { container } = render(
      <MessageList
        messages={[{ ...message, body: malicious }]}
        currentUserId="user-1"
        hasMore
        loadingPrevious={false}
        onLoadPrevious={load}
      />,
    );
    expect(screen.getByText(malicious)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Carregar mensagens anteriores" }));
    expect(load).toHaveBeenCalledOnce();
  });

  it("renderiza vazio e omite paginação quando não há cursor", () => {
    render(
      <MessageList
        messages={[]}
        currentUserId="user-1"
        hasMore={false}
        loadingPrevious={false}
        onLoadPrevious={vi.fn()}
      />,
    );
    expect(screen.getByText("Nenhuma mensagem ainda. Escreva a primeira.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mensagens anteriores/ })).not.toBeInTheDocument();
  });

  it("distingue mensagem própria e bloqueia paginação duplicada durante loading", async () => {
    const user = userEvent.setup();
    const load = vi.fn();
    render(
      <MessageList
        messages={[{ ...message, senderId: "user-1" }]}
        currentUserId="user-1"
        hasMore
        loadingPrevious
        onLoadPrevious={load}
      />,
    );
    expect(screen.getByText("Olá").closest("li")).toHaveAttribute("data-own", "true");
    const button = screen.getByRole("button", { name: "Carregando..." });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(load).not.toHaveBeenCalled();
  });
});
