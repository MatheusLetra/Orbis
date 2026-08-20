import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { membersClient } from "@/features/members/members-client";
import type { YearlyTimeline } from "./yearly-contracts";
import { YearlyTimelinePage } from "./yearly-page";

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <YearlyTimelinePage />
    </QueryClientProvider>,
  );

const companyState = vi.hoisted(() => ({
  status: "ready",
  activeCompany: { id: "company-a", name: "Alpha" },
}));
const queryState = vi.hoisted(() => ({
  isPending: false,
  isError: false,
  data: undefined as YearlyTimeline | undefined,
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
vi.mock("./yearly-queries", () => ({ useYearlyTimeline: querySpy }));
vi.mock("@/app/layouts/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const emptyMonth = (index: number) => ({
  period: `2026-${String(index + 1).padStart(2, "0")}`,
  requisitionCount: 0,
  countsByPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 },
  estimatedHours: 0,
  deliveredOnTime: 0,
  overdue: 0,
  items: [],
  undatedItems: [],
});
const yearly: YearlyTimeline = {
  companyId: "company-a",
  year: "2026",
  months: Array.from({ length: 12 }, (_, index) => emptyMonth(index)),
  indicators: { totalRequisitions: 0, estimatedHours: 0, deliveredOnTime: 0, overdue: 0 },
};

describe("YearlyTimelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryState.isPending = false;
    queryState.isError = false;
    capabilityState.members = false;
    queryState.data = {
      ...yearly,
      months: yearly.months.map((month, index) =>
        index === 0
          ? {
              ...month,
              requisitionCount: 1,
              items: [
                {
                  requisitionId: "r",
                  number: 1,
                  title: "Anual",
                  priority: "HIGH",
                  assigneeId: null,
                  startDate: "2026-01-01",
                  plannedDeliveryDate: "2026-01-02",
                  deliveredAt: null,
                  estimatedHours: 2,
                  isOverdue: false,
                  deliveredOnTime: false,
                },
              ],
              undatedItems: [
                {
                  requisitionId: "undated",
                  number: 2,
                  title: "Sem data",
                  priority: "MEDIUM",
                  assigneeId: "user-a",
                  startDate: null,
                  plannedDeliveryDate: null,
                  deliveredAt: "2026-01-03T00:00:00Z",
                  estimatedHours: 1,
                  isOverdue: true,
                  deliveredOnTime: true,
                },
              ],
            }
          : month,
      ),
    };
  });
  it("exibe doze meses, expansão e navegação", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Timeline anual" })).toBeInTheDocument();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(12);
    expect(screen.getByText("Anual")).toBeInTheDocument();
    expect(screen.getAllByText("Sem data").length).toBeGreaterThan(0);
    const firstMonthButton = screen.getAllByRole("button", { name: /2026/ })[0];
    expect(firstMonthButton).toBeDefined();
    await userEvent.setup().click(firstMonthButton as HTMLElement);
    expect(firstMonthButton).toHaveAttribute("aria-expanded", "false");
    await userEvent.setup().click(screen.getByRole("button", { name: "Ano anterior" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Ano atual" }));
    const filters = screen.getByRole("region", { name: /Filtros da timeline anual/i });
    await userEvent
      .setup()
      .selectOptions(
        filters.querySelector('[aria-label="Responsável"]') as HTMLSelectElement,
        "user-a",
      );
    await userEvent
      .setup()
      .selectOptions(filters.querySelector('[aria-label="Status"]') as HTMLSelectElement, "DONE");
    await userEvent
      .setup()
      .selectOptions(
        filters.querySelector('[aria-label="Prioridade"]') as HTMLSelectElement,
        "HIGH",
      );
    await userEvent.setup().click(screen.getByRole("button", { name: "Limpar filtros" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Próximo ano" }));
    expect(querySpy).toHaveBeenLastCalledWith("company-a", "2027", {});
  });
  it("exibe loading, erro e vazio", async () => {
    queryState.isPending = true;
    const view = renderPage();
    expect(screen.getByText("Carregando timeline anual...")).toBeInTheDocument();
    queryState.isPending = false;
    queryState.isError = true;
    view.rerender(<YearlyTimelinePage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
    queryState.isError = false;
    queryState.data = yearly;
    view.rerender(<YearlyTimelinePage />);
    expect(
      screen.getByRole("heading", { name: "Nenhuma requisição neste ano" }),
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
