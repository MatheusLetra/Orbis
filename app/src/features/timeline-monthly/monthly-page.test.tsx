import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { membersClient } from "@/features/members/members-client";
import { MonthlyTimelinePage } from "./monthly-page";
import { monthlyTimeline } from "./monthly-test-fixtures";

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MonthlyTimelinePage />
    </QueryClientProvider>,
  );

const companyState = vi.hoisted(() => ({
  status: "ready",
  activeCompany: { id: "company-a", name: "Alpha" },
}));
const queryState = vi.hoisted(() => ({
  isPending: false,
  isError: false,
  data: undefined as typeof monthlyTimeline | undefined,
  refetch: vi.fn(),
}));
const querySpy = vi.hoisted(() => vi.fn(() => queryState));
const capabilityState = vi.hoisted(() => ({ members: false }));

vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => companyState,
}));
vi.mock("@/features/companies/capabilities-queries", () => ({
  useCompanyCapabilities: () => ({
    data: { capabilities: { "users.read": capabilityState.members } },
  }),
}));
vi.mock("./monthly-queries", () => ({ useMonthlyTimeline: querySpy }));
vi.mock("@/app/layouts/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("MonthlyTimelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryState.isPending = false;
    queryState.isError = false;
    capabilityState.members = false;
    queryState.data = monthlyTimeline;
  });

  it("exibe itens, sem data, filtros, indicadores backend-only e navegação", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Timeline mensal" })).toBeInTheDocument();
    expect(screen.getByText("Preparar proposta")).toBeInTheDocument();
    expect(screen.getByText("Indicadores")).toBeInTheDocument();
    const filters = screen.getByRole("region", { name: "Filtros da timeline mensal" });
    await userEvent
      .setup()
      .selectOptions(filters.querySelector('[aria-label="Status"]') as HTMLSelectElement, "OPEN");
    await userEvent
      .setup()
      .selectOptions(
        filters.querySelector('[aria-label="Prioridade"]') as HTMLSelectElement,
        "HIGH",
      );
    await userEvent
      .setup()
      .selectOptions(
        filters.querySelector('[aria-label="Responsável"]') as HTMLSelectElement,
        "user-a",
      );
    await userEvent.setup().click(screen.getByRole("button", { name: "Limpar filtros" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(querySpy).toHaveBeenLastCalledWith(
      "company-a",
      expect.not.stringContaining("2026-08"),
      {},
    );
  });

  it("exibe loading, erro com retry e vazio", async () => {
    queryState.isPending = true;
    const view = renderPage();
    expect(screen.getByText("Carregando timeline mensal...")).toBeInTheDocument();
    queryState.isPending = false;
    queryState.isError = true;
    view.rerender(<MonthlyTimelinePage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
    queryState.isError = false;
    queryState.data = { ...monthlyTimeline, items: [], undatedItems: [] };
    view.rerender(<MonthlyTimelinePage />);
    expect(
      screen.getByRole("heading", { name: "Nenhuma requisição neste mês" }),
    ).toBeInTheDocument();
  });
  it("abre o lookup de responsável com users.read", async () => {
    capabilityState.members = true;
    vi.spyOn(membersClient, "list").mockResolvedValue([{ userId: "user-a", name: "Ana" }]);
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Buscar responsável" }));
    expect(screen.getByRole("dialog", { name: "Buscar Responsável" })).toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "Ana" }));
    await user.click(screen.getByRole("button", { name: "Limpar responsável" }));
  });
});
