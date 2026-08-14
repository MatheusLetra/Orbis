import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsPage } from "./reports-page";

const companyState = vi.hoisted(() => ({
  status: "ready",
  activeCompany: { id: "company-a", name: "Alpha" },
}));
const queryState = vi.hoisted(() => ({
  isPending: false,
  isError: false,
  data: {
    companyId: "company-a",
    items: [
      {
        id: "task",
        title: "Task longa",
        status: "DONE",
        priority: "HIGH",
        issuedAt: "2026-08-01T10:00:00.000Z",
        plannedEndDate: "2026-08-02",
        completedAt: null,
        assigneeId: null,
        assigneeName: null,
        requisitionId: null,
        requisitionNumber: null,
        requisitionTitle: null,
        estimatedHours: null,
        workedHours: 1,
      },
    ],
    total: 1,
    page: 1,
    limit: 50,
    hasMore: false,
  },
  refetch: vi.fn(),
}));
const querySpy = vi.hoisted(() => vi.fn(() => queryState));
const exportSpy = vi.hoisted(() =>
  vi.fn(async () => ({ blob: new Blob(["csv"]), headers: new Headers() })),
);
vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => companyState,
}));
vi.mock("./report-queries", () => ({ useTaskReport: querySpy }));
vi.mock("./report-client", () => ({ reportClient: { exportCsv: exportSpy } }));
vi.mock("@/app/layouts/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    companyState.status = "ready";
    queryState.isPending = false;
    queryState.isError = false;
  });
  it("exibe tabela/cards, aplica filtros, pagina e exporta", async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);
    expect(screen.getByRole("heading", { name: "Relatório de Tasks" })).toBeInTheDocument();
    expect(screen.getAllByText("Task longa").length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText("Status"), "TODO");
    await user.click(screen.getByRole("button", { name: /Exportar CSV/i }));
    expect(exportSpy).toHaveBeenCalledWith(
      "company-a",
      expect.objectContaining({ status: "TODO" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole("button", { name: /Limpar filtros/i })).toBeEnabled();
  });
  it("trata loading, erro/retry e vazio", async () => {
    queryState.isPending = true;
    const view = render(<ReportsPage />);
    expect(screen.getByText("Carregando relatório...")).toBeInTheDocument();
    queryState.isPending = false;
    queryState.isError = true;
    view.rerender(<ReportsPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
    queryState.isError = false;
    queryState.data = { ...queryState.data, items: [] };
    view.rerender(<ReportsPage />);
    expect(screen.getByRole("heading", { name: "Nenhuma Task encontrada" })).toBeInTheDocument();
  });
  it("trata empresa ausente e erro de empresas", () => {
    companyState.status = "error";
    companyState.activeCompany = null as never;
    const view = render(<ReportsPage />);
    expect(screen.getByText("Não foi possível carregar suas empresas.")).toBeInTheDocument();
    companyState.status = "ready";
    view.rerender(<ReportsPage />);
    expect(screen.getByRole("heading", { name: "Nenhuma empresa disponível" })).toBeInTheDocument();
  });
});
