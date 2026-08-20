import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { membersClient } from "@/features/members/members-client";
import { requisitionsClient } from "@/features/requisitions/requisition-client";
import { ReportsPage } from "./reports-page";

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ReportsPage />
    </QueryClientProvider>,
  );

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
const capabilityState = vi.hoisted(() => ({ members: false, requisitions: false }));
vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => companyState,
}));
vi.mock("@/features/companies/capabilities-queries", () => ({
  useCompanyCapabilities: () => ({
    data: {
      capabilities: {
        "users.read": capabilityState.members,
        "requisitions.read": capabilityState.requisitions,
      },
    },
  }),
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
    companyState.activeCompany = { id: "company-a", name: "Alpha" };
    queryState.isPending = false;
    queryState.isError = false;
    capabilityState.members = false;
    capabilityState.requisitions = false;
  });
  it("exibe tabela/cards, aplica filtros, pagina e exporta", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole("heading", { name: "Relatório de Tasks" })).toBeInTheDocument();
    expect(screen.getAllByText("Task longa").length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText("Status"), "TODO");
    await user.selectOptions(screen.getByLabelText("Prioridade"), "HIGH");
    await user.type(screen.getByLabelText("Período inicial"), "2026-08-01");
    await user.type(screen.getByLabelText("Período final"), "2026-08-31");
    await user.type(screen.getByLabelText("Requisition ID"), "req-a");
    await user.type(screen.getByLabelText("Funcionário ID"), "user-a");
    await user.click(screen.getByRole("button", { name: /Exportar CSV/i }));
    expect(exportSpy).toHaveBeenCalledWith(
      "company-a",
      expect.objectContaining({ status: "TODO" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole("button", { name: /Limpar filtros/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /Limpar filtros/i }));
  });
  it("trata loading, erro/retry e vazio", async () => {
    queryState.isPending = true;
    const view = renderPage();
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
    const view = renderPage();
    expect(screen.getByText("Não foi possível carregar suas empresas.")).toBeInTheDocument();
    companyState.status = "ready";
    view.rerender(<ReportsPage />);
    expect(screen.getByRole("heading", { name: "Nenhuma empresa disponível" })).toBeInTheDocument();
  });
  it("abre lookups de Requisition e funcionário quando as capabilities existem", async () => {
    capabilityState.members = true;
    capabilityState.requisitions = true;
    vi.spyOn(membersClient, "list").mockResolvedValue([{ userId: "user-a", name: "Ana" }]);
    vi.spyOn(requisitionsClient, "list").mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Buscar requisition" }));
    expect(screen.getByRole("dialog", { name: "Buscar Requisition" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Buscar funcionário" }));
    expect(screen.getByRole("dialog", { name: "Buscar Funcionário" })).toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "Ana" }));
    await user.click(screen.getByRole("button", { name: "Limpar funcionário" }));
  });
});
