import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/hooks/use-theme";
import { AppShell } from "./layouts/app-shell";

const authState = vi.hoisted(() => ({
  logout: vi.fn(async () => undefined),
}));
const companyState = vi.hoisted(() => ({
  companies: [
    { id: "company-a", name: "Empresa A", timezone: "UTC", settings: {}, isActive: true },
    { id: "company-b", name: "Empresa B", timezone: "UTC", settings: {}, isActive: true },
  ],
  activeCompany: null as { id: string; name: string } | null,
  selectCompany: vi.fn(),
}));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: "user-1" }, ...authState }),
}));
vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => companyState,
}));

function renderShell() {
  return render(
    <ThemeProvider>
      <AppShell>
        <p>Conteúdo</p>
      </AppShell>
    </ThemeProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    companyState.activeCompany = null;
    companyState.companies = [
      { id: "company-a", name: "Empresa A", timezone: "UTC", settings: {}, isActive: true },
      { id: "company-b", name: "Empresa B", timezone: "UTC", settings: {}, isActive: true },
    ];
  });

  it("renderiza marca, seletor, tema, logout, conteúdo e rodapé", () => {
    renderShell();

    expect(screen.getByText("Orbis")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Empresa ativa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alternar tema" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/chat");
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
    expect(screen.getByText(/gestão de requisições/)).toBeInTheDocument();
  });

  it("contém controles mobile sem largura rígida e protege nomes longos", () => {
    const longName = "Empresa com um nome extremamente longo para testar truncamento seguro";
    companyState.companies = [
      { id: "company-a", name: longName, timezone: "UTC", settings: {}, isActive: true },
      { id: "company-b", name: "Outra empresa", timezone: "UTC", settings: {}, isActive: true },
    ];
    companyState.activeCompany = { id: "company-a", name: longName };
    renderShell();

    const header = screen.getByRole("banner");
    const select = screen.getByRole("combobox", { name: "Empresa ativa" });
    expect(header).toHaveClass("app-shell-header");
    expect(select).toHaveClass("app-shell-company-select");
    expect(select).toHaveAttribute("title", longName);
    expect(select).toHaveStyle({
      width: "100%",
      minWidth: "0",
      maxWidth: "100%",
      boxSizing: "border-box",
    });
    expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);
  });

  it("preserva troca de empresa, tema e logout", async () => {
    const user = userEvent.setup();
    renderShell();

    const select = screen.getByRole("combobox", { name: "Empresa ativa" });
    await user.selectOptions(select, "company-b");
    expect(companyState.selectCompany).toHaveBeenCalledWith("company-b");

    await user.click(screen.getByRole("button", { name: "Alternar tema" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(authState.logout).toHaveBeenCalledOnce();

    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    await user.click(screen.getByRole("button", { name: "Voltar para a tela anterior" }));
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });

  it("integra o botão de notificações com o tenant ativo", () => {
    companyState.activeCompany = { id: "company-a", name: "Empresa A" };
    renderShell();

    const notifications = screen.getByRole("button", { name: "Notificações" });
    expect(notifications).toBeEnabled();
    expect(notifications).toHaveAttribute("aria-haspopup", "dialog");
    expect(notifications).toHaveAttribute("aria-expanded", "false");
  });

  it("mantém uma sequência de foco previsível com Tab e Shift+Tab", async () => {
    const user = userEvent.setup();
    renderShell();
    const select = screen.getByRole("combobox", { name: "Empresa ativa" });
    const chat = screen.getByRole("link", { name: "Chat" });
    const theme = screen.getByRole("button", { name: "Alternar tema" });
    const logout = screen.getByRole("button", { name: "Sair" });

    await user.tab();
    expect(select).toHaveFocus();
    await user.tab();
    expect(chat).toHaveFocus();
    await user.tab();
    expect(theme).toHaveFocus();
    await user.tab();
    expect(logout).toHaveFocus();
    await user.tab({ shift: true });
    expect(theme).toHaveFocus();
    await user.tab({ shift: true });
    expect(chat).toHaveFocus();
    await user.tab({ shift: true });
    expect(select).toHaveFocus();
  });
});
