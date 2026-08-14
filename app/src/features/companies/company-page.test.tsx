import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyPage } from "./company-page";

const companyState = vi.hoisted(() => ({
  status: "ready" as "idle" | "loading" | "ready" | "error",
  companies: [] as Array<{
    id: string;
    name: string;
    timezone: string;
    settings: Record<string, unknown>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>,
  activeCompany: null as null | {
    id: string;
    name: string;
    timezone: string;
    settings: Record<string, unknown>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  },
  error: null as Error | null,
  selectCompany: vi.fn(),
}));
const capabilitiesState = vi.hoisted(() => ({
  data: undefined as undefined | { companyId: string; capabilities: Record<string, boolean> },
  refetch: vi.fn(),
}));
const panelSpy = vi.hoisted(() => vi.fn());

vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => companyState,
}));
vi.mock("@/features/companies/capabilities-queries", () => ({
  useCompanyCapabilities: vi.fn(() => capabilitiesState),
}));
vi.mock("@/app/layouts/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/features/capacity/capacity-simulation-panel", () => ({
  CapacitySimulationPanel: (props: unknown) => {
    panelSpy(props);
    return <div data-testid="capacity-panel" />;
  },
}));

const alpha = {
  id: "company-a",
  name: "Empresa Alpha",
  timezone: "America/Sao_Paulo",
  settings: {},
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const beta = { ...alpha, id: "company-b", name: "Empresa Beta", timezone: "UTC" };

function renderPage() {
  return render(
    <MemoryRouter>
      <CompanyPage />
    </MemoryRouter>,
  );
}

describe("CompanyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    companyState.status = "ready";
    companyState.companies = [];
    companyState.activeCompany = null;
    companyState.error = null;
    capabilitiesState.data = undefined;
  });

  it.each(["loading", "idle"] as const)("mostra loading no estado %s", (status) => {
    companyState.status = status;
    renderPage();

    expect(screen.getByText("Carregando empresas...")).toHaveAttribute("aria-busy", "true");
  });

  it("mostra erro ao falhar o carregamento", () => {
    companyState.status = "error";
    companyState.error = new Error("network");
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar suas empresas.");
  });

  it("mostra o estado vazio quando não há empresas", () => {
    renderPage();
    expect(screen.getByText("Você não possui empresas disponíveis.")).toBeInTheDocument();
  });

  it("lista empresas quando nenhuma está ativa e permite selecionar", async () => {
    companyState.companies = [alpha, beta];
    renderPage();

    expect(screen.getByRole("heading", { name: "Escolha uma empresa" })).toBeInTheDocument();
    expect(screen.getByText("America/Sao_Paulo")).toBeInTheDocument();
    expect(screen.getByText("UTC")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Empresa Beta/ }));
    expect(companyState.selectCompany).toHaveBeenCalledWith("company-b");
  });

  it("renderiza a empresa ativa e o link para o board", () => {
    companyState.companies = [alpha];
    companyState.activeCompany = alpha;
    renderPage();

    expect(screen.getByRole("heading", { name: "Empresa Alpha" })).toBeInTheDocument();
    expect(screen.getByText("Contexto ativo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir board" })).toHaveAttribute("href", "/kanban");
  });

  it("consulta e repassa capabilities da empresa ativa ao painel", async () => {
    const { useCompanyCapabilities } = await import("./capabilities-queries");
    const capabilities = {
      companyId: alpha.id,
      capabilities: { "capacity.read": true },
    };
    companyState.companies = [alpha];
    companyState.activeCompany = alpha;
    capabilitiesState.data = capabilities;
    renderPage();

    expect(useCompanyCapabilities).toHaveBeenCalledWith("company-a");
    expect(panelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-a", capabilities }),
    );

    const props = panelSpy.mock.calls[0]?.[0] as { onCapabilitiesForbidden: () => void };
    props.onCapabilitiesForbidden();
    expect(capabilitiesState.refetch).toHaveBeenCalledOnce();
  });

  it("não consulta capabilities para uma empresa inexistente", async () => {
    const { useCompanyCapabilities } = await import("./capabilities-queries");
    renderPage();
    expect(useCompanyCapabilities).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId("capacity-panel")).not.toBeInTheDocument();
  });
});
