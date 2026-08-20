import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conversation } from "./chat-test-fixtures";
import { ConversationList } from "./conversation-list";

const mutation = vi.hoisted(() => ({
  isPending: false,
  isSuccess: false,
  isError: false,
  data: { id: "conversation-1" },
  create: vi.fn(() => true),
  reset: vi.fn(),
}));
vi.mock("./chat-mutations", () => ({ useCreateConversation: () => mutation }));
vi.mock("@/features/chat/chat-client", () => ({
  chatClient: {
    listParticipants: vi.fn(async () => [
      { userId: "550e8400-e29b-41d4-a716-446655440002", name: "Ana" },
    ]),
  },
}));

describe("ConversationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutation.isPending = false;
    mutation.isSuccess = false;
    mutation.isError = false;
  });

  it("mantém somente entrada manual quando chat.use não está disponível", () => {
    render(
      <ConversationList
        companyId="company-a"
        currentUserId="user-1"
        conversations={[]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Buscar participante" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Iniciar conversa/ })).toBeInTheDocument();
  });

  it("exige UUID e preserva o valor em erro canônico", async () => {
    const user = userEvent.setup();
    const view = render(
      <ConversationList
        companyId="company-a"
        currentUserId="user-1"
        conversations={[]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const input = screen.getByRole("textbox", { name: /Iniciar conversa/ });
    await user.type(input, "inválido");
    await user.click(screen.getByRole("button", { name: "Criar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("UUID válido");
    expect(mutation.create).not.toHaveBeenCalled();
    mutation.isError = true;
    view.rerender(
      <ConversationList
        companyId="company-a"
        currentUserId="user-1"
        conversations={[]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(input).toHaveValue("inválido");
  });

  it("cria por UUID e seleciona conversa existente", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(
      <ConversationList
        companyId="company-a"
        currentUserId="user-1"
        conversations={[conversation]}
        selectedId={null}
        onSelect={select}
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: /Iniciar conversa/ }),
      "550e8400-e29b-41d4-a716-446655440000",
    );
    await user.click(screen.getByRole("button", { name: "Criar" }));
    expect(mutation.create).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000");
    await user.click(screen.getByRole("button", { name: /Ana/ }));
    expect(select).toHaveBeenCalledWith("conversation-1");
  });

  it("oferece lookup visual, seleciona o userId e permite limpar ou cancelar", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ConversationList
          companyId="company-a"
          currentUserId="user-1"
          conversations={[]}
          selectedId={null}
          onSelect={vi.fn()}
          enableParticipantLookup
        />
      </QueryClientProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Buscar participante" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Buscar Participante" });
    expect(within(dialog).getByLabelText("Busca")).toHaveFocus();
    await user.click(within(dialog).getByRole("option", { name: "Ana" }));
    expect(screen.getByText("Selecionado: Ana")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar" }));
    expect(mutation.create).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440002");
    expect(screen.getByRole("button", { name: "Limpar participante" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Limpar participante" }));
    expect(screen.getByText("Nenhum registro selecionado")).toBeInTheDocument();

    await user.click(trigger);
    const reopened = await screen.findByRole("dialog", { name: "Buscar Participante" });
    await user.click(within(reopened).getByRole("button", { name: "Fechar" }));
    expect(screen.getByRole("button", { name: "Buscar participante" })).toHaveFocus();
  });

  it("limpa e seleciona somente depois do sucesso canônico da criação", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const view = render(
      <ConversationList
        companyId="company-a"
        currentUserId="user-1"
        conversations={[]}
        selectedId={null}
        onSelect={select}
      />,
    );
    const input = screen.getByRole("textbox", { name: /Iniciar conversa/ });
    await user.type(input, "550e8400-e29b-41d4-a716-446655440000");
    await user.click(screen.getByRole("button", { name: "Criar" }));
    expect(input).toHaveValue("550e8400-e29b-41d4-a716-446655440000");

    mutation.isSuccess = true;
    view.rerender(
      <ConversationList
        companyId="company-a"
        currentUserId="user-1"
        conversations={[]}
        selectedId={null}
        onSelect={select}
      />,
    );
    expect(input).toHaveValue("");
    expect(select).toHaveBeenCalledWith("conversation-1");
    expect(mutation.reset).toHaveBeenCalled();
  });

  it("mostra pending, erro seguro, contador 99+ e fallback para o próprio participante", () => {
    mutation.isPending = true;
    mutation.isError = true;
    render(
      <ConversationList
        companyId="company-a"
        currentUserId="user-1"
        conversations={[
          {
            ...conversation,
            participants: [{ userId: "user-1", name: "Matheus" }],
            unreadCount: 120,
            lastMessage: null,
          },
        ]}
        selectedId="conversation-1"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Criando..." })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível criar");
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.getByText("120 mensagens não lidas")).toBeInTheDocument();
    expect(screen.getByText("Conversa sem mensagens")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Matheus/ })).toHaveAttribute("aria-current", "true");
  });
});
