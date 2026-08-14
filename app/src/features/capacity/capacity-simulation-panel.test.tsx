import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyCapabilities } from "@/features/companies/capabilities-contracts";
import { ApiError } from "@/lib/http/api-error";
import { useCapacity } from "./capacity-queries";
import { CapacitySimulationPanel } from "./capacity-simulation-panel";

vi.mock("./capacity-queries", () => ({ useCapacity: vi.fn() }));

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const capabilities: CompanyCapabilities = {
  companyId: COMPANY_ID,
  capabilities: {
    "tasks.create": false,
    "tasks.update": false,
    "kanban.manage": false,
    "hours.register": false,
    "capacity.read": true,
    "users.read": false,
    "requisitions.read": false,
  },
};
const output = {
  companyId: COMPANY_ID,
  startDate: "2026-08-17T00:00:00.000Z",
  estimatedHours: 24,
  availableDevelopers: 3,
  dailyHoursPerDeveloper: 8,
  dailyCapacity: 24,
  requiredDays: 1,
  plannedDeliveryDate: "2026-08-18T00:00:00.000Z",
};

const mockedUseCapacity = vi.mocked(useCapacity);

function queryState(overrides: Partial<ReturnType<typeof useCapacity>> = {}) {
  return {
    data: undefined,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useCapacity>;
}

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof CapacitySimulationPanel>> = {},
) {
  const props = {
    companyId: COMPANY_ID,
    capabilities,
    onCapabilitiesForbidden: vi.fn(),
    ...overrides,
  };
  return render(<CapacitySimulationPanel {...props} />);
}

describe("CapacitySimulationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCapacity.mockReturnValue(queryState());
  });

  it("fica oculto sem capability ou com companyId divergente", () => {
    const { rerender } = renderPanel({ capabilities: undefined });
    expect(screen.queryByText("Simulação de capacidade")).not.toBeInTheDocument();

    rerender(
      <CapacitySimulationPanel
        companyId={COMPANY_ID}
        capabilities={{ ...capabilities, companyId: "22222222-2222-4222-8222-222222222222" }}
        onCapabilitiesForbidden={vi.fn()}
      />,
    );
    expect(screen.queryByText("Simulação de capacidade")).not.toBeInTheDocument();
  });

  it("mostra formulário inicial e envia parâmetros explícitos, inclusive zero", async () => {
    const user = userEvent.setup();
    mockedUseCapacity.mockImplementation((_companyId, _capabilities, input) =>
      queryState(input ? { data: { ...output, ...input } } : {}),
    );
    renderPanel();

    expect(screen.getByRole("heading", { name: "Simulação de capacidade" })).toBeInTheDocument();
    expect(screen.getByLabelText("Data inicial")).toHaveValue("");
    expect(screen.getByLabelText("Horas estimadas")).toHaveValue(null);
    expect(screen.getByText("Nenhuma simulação realizada")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Data inicial"), "2026-08-17");
    await user.type(screen.getByLabelText("Horas estimadas"), "0");
    await user.click(screen.getByRole("button", { name: "Calcular simulação" }));

    expect(mockedUseCapacity).toHaveBeenLastCalledWith(
      COMPANY_ID,
      capabilities,
      { startDate: "2026-08-17T00:00:00.000Z", estimatedHours: 0 },
      expect.objectContaining({ onForbidden: expect.any(Function) }),
    );
    expect(screen.getByText("Não persistida")).toBeInTheDocument();
    expect(screen.getByText("Desenvolvedores disponíveis")).toBeInTheDocument();
    expect(screen.getByText("Data prevista")).toBeInTheDocument();
  });

  it("valida campos, foca o primeiro inválido e preserva valores", async () => {
    const user = userEvent.setup();
    renderPanel();
    const date = screen.getByLabelText("Data inicial");
    const hours = screen.getByLabelText("Horas estimadas");
    await user.type(date, "2026-02-28");
    await user.type(hours, "-1");
    await user.click(screen.getByRole("button", { name: "Calcular simulação" }));

    expect(screen.getByText("Informe um número maior ou igual a zero.")).toBeInTheDocument();
    expect(hours).toHaveFocus();
    expect(date).toHaveValue("2026-02-28");
    expect(hours).toHaveValue(-1);
    expect(mockedUseCapacity).toHaveBeenLastCalledWith(
      COMPANY_ID,
      capabilities,
      null,
      expect.any(Object),
    );
  });

  it("rejeita data vazia e move o foco para o primeiro erro", async () => {
    const user = userEvent.setup();
    renderPanel();
    const date = screen.getByLabelText("Data inicial");
    await user.type(screen.getByLabelText("Horas estimadas"), "1");
    await user.click(screen.getByRole("button", { name: "Calcular simulação" }));

    expect(screen.getByText("Informe uma data válida.")).toBeInTheDocument();
    expect(date).toHaveFocus();
  });

  it("exibe loading, erro de configuração, capacidade zero e permite retry", async () => {
    const refetch = vi.fn();
    mockedUseCapacity.mockReturnValue(queryState({ isPending: true, isFetching: true }));
    const { rerender } = renderPanel();
    expect(screen.getByRole("status")).toHaveTextContent("Calculando capacidade...");

    mockedUseCapacity.mockReturnValue(
      queryState({
        isError: true,
        error: new ApiError({
          status: 422,
          code: "CAPACITY_CONFIGURATION_MISSING",
          message: "A capacidade não está configurada",
        }),
        refetch,
      }),
    );
    rerender(
      <CapacitySimulationPanel
        {...{ companyId: COMPANY_ID, capabilities, onCapabilitiesForbidden: vi.fn() }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("capacidade diária");
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("preserva mensagem de capacidade zero e erros HTTP", () => {
    mockedUseCapacity.mockReturnValue(
      queryState({
        isError: true,
        error: new ApiError({ status: 422, code: "CAPACITY_ZERO", message: "zero" }),
      }),
    );
    renderPanel();
    expect(screen.getByRole("alert")).toHaveTextContent("Não há desenvolvedores elegíveis");
  });

  it.each([
    [400, "Confira os parâmetros informados"],
    [403, "não possui acesso"],
    [404, "não foi encontrada"],
    [422, "Confira os parâmetros"],
    [500, "Não foi possível calcular agora"],
  ])(
    "exibe mensagem acessível para erro HTTP %s e preserva o formulário",
    async (status, message) => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockedUseCapacity.mockReturnValue(
        queryState({
          isError: true,
          error: new ApiError({ status, code: "ERROR", message: "server" }),
          refetch,
        }),
      );
      renderPanel();
      const date = screen.getByLabelText("Data inicial");
      const hours = screen.getByLabelText("Horas estimadas");
      await user.type(date, "2026-08-17");
      await user.type(hours, "12");

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(date).toHaveValue("2026-08-17");
      expect(hours).toHaveValue(12);
      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
      expect(refetch).toHaveBeenCalledTimes(1);
    },
  );

  it("refaz capabilities somente pelo callback do tenant atual em 403", async () => {
    const onCapabilitiesForbidden = vi.fn();
    let forbiddenCallback: (() => void) | undefined;
    mockedUseCapacity.mockImplementation((_companyId, _capabilities, _input, options) => {
      forbiddenCallback = options?.onForbidden;
      return queryState();
    });
    renderPanel({ onCapabilitiesForbidden });

    forbiddenCallback?.();
    await waitFor(() => expect(onCapabilitiesForbidden).toHaveBeenCalledTimes(1));
    expect(onCapabilitiesForbidden).toHaveBeenCalledWith();
  });

  it("envia por teclado, anuncia o resultado e mantém o foco no resultado", async () => {
    const user = userEvent.setup();
    mockedUseCapacity.mockImplementation((_companyId, _capabilities, input) =>
      queryState(input ? { data: { ...output, ...input } } : {}),
    );
    renderPanel();
    const date = screen.getByLabelText("Data inicial");
    const hours = screen.getByLabelText("Horas estimadas");

    await user.type(date, "2026-08-17");
    await user.type(hours, "8");
    await user.tab();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(hours).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Não persistida").closest("section")).toHaveFocus();
  });

  it("reseta parâmetros ao trocar de empresa e mantém estrutura responsiva", async () => {
    const user = userEvent.setup();
    const { rerender } = renderPanel();
    await user.type(screen.getByLabelText("Data inicial"), "2026-08-17");
    await user.type(screen.getByLabelText("Horas estimadas"), "4");
    rerender(
      <CapacitySimulationPanel
        companyId="22222222-2222-4222-8222-222222222222"
        capabilities={{ ...capabilities, companyId: "22222222-2222-4222-8222-222222222222" }}
        onCapabilitiesForbidden={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Data inicial")).toHaveValue("");
    expect(screen.getByLabelText("Horas estimadas")).toHaveValue(null);
    expect(screen.getByText("Simulação de capacidade").closest("section")).toHaveClass(
      "overflow-hidden",
    );
  });
});
