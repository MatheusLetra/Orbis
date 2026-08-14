import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MonthlyTimelinePage } from "./monthly-page";
import { monthlyTimeline } from "./monthly-test-fixtures";

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

vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => companyState,
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
    queryState.data = monthlyTimeline;
  });

  it("exibe itens, sem data, filtros, indicadores backend-only e navegação", async () => {
    render(<MonthlyTimelinePage />);
    expect(screen.getByRole("heading", { name: "Timeline mensal" })).toBeInTheDocument();
    expect(screen.getByText("Preparar proposta")).toBeInTheDocument();
    expect(screen.getByText("Indicadores")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(querySpy).toHaveBeenLastCalledWith(
      "company-a",
      expect.not.stringContaining("2026-08"),
      {},
    );
  });

  it("exibe loading, erro com retry e vazio", async () => {
    queryState.isPending = true;
    const view = render(<MonthlyTimelinePage />);
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
});
