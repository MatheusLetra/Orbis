import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimelinePage } from "./timeline-page";
import { weeklyTimeline } from "./timeline-test-fixtures";

const companyState = vi.hoisted(() => ({
  status: "ready" as "ready" | "idle" | "loading" | "error",
  activeCompany: { id: "company-a", name: "Alpha" } as { id: string; name: string } | null,
  companies: [{ id: "company-a" }],
}));
const queryState = vi.hoisted(() => ({
  isPending: false,
  isError: false,
  data: undefined as typeof weeklyTimeline | undefined,
  error: null,
  refetch: vi.fn(),
}));
const querySpy = vi.hoisted(() =>
  vi.fn((_companyId: string | null, _weekStart: string, _filters: unknown) => queryState),
);

vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => companyState,
}));
vi.mock("./timeline-queries", () => ({ useWeeklyTimeline: querySpy }));
vi.mock("@/app/layouts/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("TimelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    companyState.status = "ready";
    queryState.isPending = false;
    queryState.isError = false;
    queryState.data = weeklyTimeline;
  });

  it("renderiza grid seg-sex, coleções especiais e indicadores somente leitura", () => {
    render(<TimelinePage />);
    expect(screen.getByRole("heading", { name: "Timeline semanal" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5);
    expect(screen.getByRole("region", { name: /Grade da timeline semanal/ })).toHaveClass(
      "overflow-x-auto",
    );
    expect(screen.getByText("Publicar versão")).toBeInTheDocument();
    expect(screen.getByLabelText("Tarefa pausada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Em atraso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fim de semana" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sem data/ })).toBeInTheDocument();
    expect(screen.getAllByText("Corrigir pendência")).toHaveLength(1);
    expect(screen.getAllByText("Acompanhar publicação")).toHaveLength(1);
    expect(screen.getAllByText("Revisar backlog")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Publicar versão/ })).not.toBeInTheDocument();
  });

  it("altera semana e filtros e permite limpar", async () => {
    const user = userEvent.setup();
    render(<TimelinePage />);
    await user.click(screen.getByRole("button", { name: "Próxima semana" }));
    expect(querySpy).toHaveBeenLastCalledWith("company-a", expect.any(String), {});
    const nextWeek = querySpy.mock.calls.at(-1)?.[1];
    const previousWeek = querySpy.mock.calls.at(-2)?.[1];
    expect(nextWeek).not.toBe(previousWeek);

    await user.selectOptions(screen.getByLabelText("Responsável"), "user-a");
    await user.selectOptions(screen.getByLabelText("Status"), "PAUSED");
    await user.selectOptions(screen.getByLabelText("Prioridade"), "HIGH");
    expect(querySpy).toHaveBeenLastCalledWith("company-a", nextWeek, {
      assigneeId: "user-a",
      status: "PAUSED",
      priority: "HIGH",
    });
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(querySpy).toHaveBeenLastCalledWith("company-a", nextWeek, {});
  });

  it("trata loading, erro com retry e vazio", async () => {
    queryState.isPending = true;
    const view = render(<TimelinePage />);
    expect(screen.getByText("Carregando timeline...")).toBeInTheDocument();
    queryState.isPending = false;
    queryState.isError = true;
    view.rerender(<TimelinePage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
    queryState.isError = false;
    queryState.data = {
      ...weeklyTimeline,
      days: weeklyTimeline.days.map((day) => ({ ...day, tasks: [] })),
      undatedTasks: [],
      overdueTasks: [],
      weekendTasks: [],
    };
    view.rerender(<TimelinePage />);
    expect(
      screen.getByRole("heading", { name: "Nenhuma tarefa nesta semana" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["error", "Não foi possível carregar suas empresas."],
    ["ready", "Nenhuma empresa disponível"],
  ] as const)("renderiza estado de empresa %s sem empresa ativa", (status, message) => {
    companyState.status = status;
    companyState.activeCompany = null;
    companyState.companies = [];
    render(<TimelinePage />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(querySpy).toHaveBeenCalledWith(null, expect.any(String), {});
  });
});
