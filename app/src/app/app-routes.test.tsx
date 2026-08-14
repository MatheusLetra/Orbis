import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./app";

const routeState = vi.hoisted(() => ({ entry: "/" }));
const authState = vi.hoisted(() => ({
  status: "initializing" as "initializing" | "authenticated" | "unauthenticated",
}));

vi.mock("@/app/providers/app-providers", () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[routeState.entry]}>{children}</MemoryRouter>
  ),
}));
vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => authState,
}));
vi.mock("@/features/auth/login-page", () => ({
  LoginPage: () => {
    const location = useLocation();
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return <p>Página de login; origem: {from ?? "nenhuma"}</p>;
  },
}));
vi.mock("@/features/companies/company-page", () => ({
  CompanyPage: () => <p>Página da empresa</p>,
}));
vi.mock("@/features/kanban/kanban-page", () => ({
  KanbanPage: () => <p>Página do kanban</p>,
}));

function renderRoute(entry: string, status: typeof authState.status) {
  routeState.entry = entry;
  authState.status = status;
  return render(<App />);
}

describe("App routes", () => {
  beforeEach(() => {
    routeState.entry = "/";
    authState.status = "initializing";
  });

  it("aguarda a inicialização da sessão antes de renderizar rotas", () => {
    renderRoute("/kanban", "initializing");

    expect(screen.getByText("Restaurando sessão...").closest("main")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByText("Página do kanban")).not.toBeInTheDocument();
  });

  it("renderiza login para usuário não autenticado", () => {
    renderRoute("/login", "unauthenticated");
    expect(screen.getByText("Página de login; origem: nenhuma")).toBeInTheDocument();
  });

  it.each(["/", "/outra-rota", "/kanban"])(
    "protege %s e preserva a rota de origem",
    async (entry) => {
      renderRoute(entry, "unauthenticated");
      expect(await screen.findByText(`Página de login; origem: ${entry}`)).toBeInTheDocument();
    },
  );

  it("redireciona usuário autenticado do login para a empresa", async () => {
    renderRoute("/login", "authenticated");
    expect(await screen.findByText("Página da empresa")).toBeInTheDocument();
    expect(screen.queryByText(/Página de login/)).not.toBeInTheDocument();
  });

  it("renderiza a empresa para usuário autenticado na rota raiz e no fallback", () => {
    const root = renderRoute("/", "authenticated");
    expect(screen.getByText("Página da empresa")).toBeInTheDocument();

    root.unmount();
    renderRoute("/desconhecida", "authenticated");
    expect(screen.getByText("Página da empresa")).toBeInTheDocument();
  });

  it("renderiza o kanban para usuário autenticado", () => {
    renderRoute("/kanban", "authenticated");
    expect(screen.getByText("Página do kanban")).toBeInTheDocument();
  });
});
