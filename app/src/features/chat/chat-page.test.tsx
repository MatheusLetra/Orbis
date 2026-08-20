import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "./chat-page";
import { conversation, messagePage } from "./chat-test-fixtures";

const state = vi.hoisted(() => ({
  company: {
    status: "ready",
    activeCompany: { id: "company-a", name: "Empresa A" } as {
      id: string;
      name: string;
    } | null,
    companies: [{ id: "company-a" }],
  },
  conversations: {
    data: { items: [] as unknown[] },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  messages: {
    data: { pages: [] as unknown[] },
    isPending: false,
    isError: false,
    isSuccess: true,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  },
  markRead: vi.fn(),
}));

vi.mock("@/app/layouts/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => state.company,
}));
vi.mock("@/features/companies/capabilities-queries", () => ({
  useCompanyCapabilities: () => ({ data: { capabilities: { "chat.use": false } } }),
}));
vi.mock("./chat-queries", async (importOriginal) => {
  const original = await importOriginal<typeof import("./chat-queries")>();
  return {
    ...original,
    useConversations: () => state.conversations,
    useMessages: () => state.messages,
  };
});
vi.mock("./chat-mutations", () => ({
  useMarkConversationRead: () => ({ markRead: state.markRead }),
  useCreateConversation: () => ({
    isPending: false,
    isSuccess: false,
    isError: false,
    create: vi.fn(),
    reset: vi.fn(),
  }),
  useSendMessage: () => ({
    isPending: false,
    isSuccess: false,
    isError: false,
    send: vi.fn(),
    reset: vi.fn(),
  }),
}));

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.conversations.data.items = [conversation];
    state.messages.data.pages = [messagePage];
    state.company.status = "ready";
    state.company.activeCompany = { id: "company-a", name: "Empresa A" };
    state.company.companies = [{ id: "company-a" }];
    state.conversations.isPending = false;
    state.conversations.isError = false;
    state.messages.isPending = false;
    state.messages.isError = false;
    state.messages.isSuccess = true;
    state.messages.hasNextPage = false;
    state.messages.isFetchingNextPage = false;
  });

  it("seleciona conversa, mostra mensagens canônicas e marca leitura após carga", async () => {
    const user = userEvent.setup();
    render(<ChatPage />);
    await user.click(screen.getByRole("button", { name: /Ana/ }));
    expect(screen.getAllByText("Olá")).toHaveLength(2);
    expect(state.markRead).toHaveBeenCalledWith("conversation-1");
  });

  it("mostra erro seguro e retry sem vazar erro backend", async () => {
    const user = userEvent.setup();
    state.conversations.isError = true;
    render(<ChatPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Verifique seu acesso");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(state.conversations.refetch).toHaveBeenCalledOnce();
  });

  it("reinicia seleção quando o provider remonta a página na troca de tenant", async () => {
    const user = userEvent.setup();
    const firstTenant = render(<ChatPage />);
    await user.click(screen.getByRole("button", { name: /Ana/ }));
    expect(screen.getByRole("heading", { name: "Ana", level: 2 })).toBeInTheDocument();
    firstTenant.unmount();

    state.company.activeCompany = { id: "company-b", name: "Empresa B" };
    state.company.companies = [{ id: "company-b" }];
    state.conversations.data.items = [];
    render(<ChatPage />);
    expect(screen.getByRole("heading", { name: "Selecione uma conversa" })).toBeInTheDocument();
  });

  it.each([
    ["loading", null, [{ id: "company-a" }], "Carregando empresa ativa..."],
    ["error", null, [{ id: "company-a" }], "Não foi possível carregar suas empresas."],
    ["ready", null, [], "Nenhuma empresa disponível"],
  ])("renderiza estado da empresa %s", (status, activeCompany, companies, expected) => {
    state.company.status = status;
    state.company.activeCompany = activeCompany;
    state.company.companies = companies;
    render(<ChatPage />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renderiza loading e vazio da lista de conversas", () => {
    state.conversations.isPending = true;
    const loading = render(<ChatPage />);
    expect(screen.getByText("Carregando conversas...")).toBeInTheDocument();
    loading.unmount();

    state.conversations.isPending = false;
    state.conversations.data.items = [];
    render(<ChatPage />);
    expect(screen.getByText(/Nenhuma conversa/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Selecione uma conversa" })).toBeInTheDocument();
  });

  it("renderiza loading e erro de mensagens com retry", async () => {
    const user = userEvent.setup();
    state.messages.isPending = true;
    state.messages.isSuccess = false;
    const loading = render(<ChatPage />);
    await user.click(screen.getByRole("button", { name: /Ana/ }));
    expect(screen.getByText("Carregando mensagens...")).toBeInTheDocument();
    expect(state.markRead).not.toHaveBeenCalled();
    loading.unmount();

    state.messages.isPending = false;
    state.messages.isError = true;
    state.messages.isSuccess = false;
    render(<ChatPage />);
    await user.click(screen.getByRole("button", { name: /Ana/ }));
    expect(screen.getByText(/Não foi possível carregar as mensagens/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(state.messages.refetch).toHaveBeenCalledOnce();
  });

  it("carrega páginas anteriores e marca cada conversa apenas uma vez", async () => {
    const user = userEvent.setup();
    state.messages.hasNextPage = true;
    render(<ChatPage />);
    const conversationButton = screen.getByRole("button", { name: /Ana/ });
    await user.click(conversationButton);
    await user.click(screen.getByRole("button", { name: "Carregar mensagens anteriores" }));
    expect(state.messages.fetchNextPage).toHaveBeenCalledOnce();
    expect(state.markRead).toHaveBeenCalledOnce();
    await user.click(conversationButton);
    expect(state.markRead).toHaveBeenCalledOnce();
  });

  it("mantém a thread quando a conversa selecionada deixa a lista canônica", async () => {
    const user = userEvent.setup();
    const view = render(<ChatPage />);
    await user.click(screen.getByRole("button", { name: /Ana/ }));
    state.conversations.data.items = [];
    view.rerender(<ChatPage />);
    expect(screen.getByRole("heading", { name: "Conversa" })).toBeInTheDocument();
  });
});
