import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { capacityClient } from "./capacity-client";
import type { CapacitySimulationInput } from "./capacity-contracts";
import { capacityKeys } from "./capacity-keys";
import { useCapacity } from "./capacity-queries";

const companyId = "11111111-1111-4111-8111-111111111111";
const otherCompanyId = "22222222-2222-4222-8222-222222222222";
const input: CapacitySimulationInput = {
  startDate: "2026-08-17T00:00:00.000Z",
  estimatedHours: 24,
};
const capabilities = {
  companyId,
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
const response = {
  companyId,
  ...input,
  availableDevelopers: 3,
  dailyHoursPerDeveloper: 8,
  dailyCapacity: 24,
  requiredDays: 1,
  plannedDeliveryDate: "2026-08-18T00:00:00.000Z",
};

function wrapper(client: ReturnType<typeof createQueryClient>) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useCapacity", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("habilita somente com capability/tenant/parâmetros válidos e passa signal", async () => {
    const client = createQueryClient();
    const request = vi.spyOn(capacityClient, "getCapacity").mockResolvedValue(response);
    const { result } = renderHook(() => useCapacity(companyId, capabilities, input), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledWith(companyId, input, { signal: expect.any(AbortSignal) });
    expect(client.getQueryData(capacityKeys.simulation(companyId, input))).toEqual(response);
  });

  it.each([
    ["sem tenant", null, capabilities, input],
    ["companyId inválido", "not-a-uuid", { ...capabilities, companyId: "not-a-uuid" }, input],
    [
      "sem capability",
      companyId,
      { ...capabilities, capabilities: { ...capabilities.capabilities, "capacity.read": false } },
      input,
    ],
    ["tenant divergente", companyId, { ...capabilities, companyId: otherCompanyId }, input],
    ["sem parâmetros", companyId, capabilities, null],
    ["parâmetros inválidos", companyId, capabilities, { ...input, estimatedHours: -1 }],
  ])("permanece desabilitado %s", (_label, tenant, capability, simulation) => {
    const client = createQueryClient();
    const request = vi.spyOn(capacityClient, "getCapacity");
    const { result } = renderHook(() => useCapacity(tenant, capability, simulation), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(request).not.toHaveBeenCalled();
  });

  it("preserva ApiError e aciona refetch de capabilities em 403", async () => {
    const client = createQueryClient();
    const onForbidden = vi.fn();
    const error = new ApiError({ status: 403, code: "FORBIDDEN", message: "Sem acesso" });
    vi.spyOn(capacityClient, "getCapacity").mockRejectedValue(error);
    const { result } = renderHook(
      () => useCapacity(companyId, capabilities, input, { onForbidden }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error).toBe(error);
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it("aborta a requisição quando o último observador é desmontado", async () => {
    const client = createQueryClient();
    let requestSignal: AbortSignal | undefined;
    vi.spyOn(capacityClient, "getCapacity").mockImplementation(
      async (_companyId, _input, options) => {
        requestSignal = options?.signal ?? undefined;
        await new Promise<never>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
        throw new Error("unreachable");
      },
    );
    const view = renderHook(() => useCapacity(companyId, capabilities, input), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(requestSignal).toBeDefined());
    view.unmount();
    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
  });

  it("separa cache ao trocar parâmetros e não reutiliza resultado anterior", async () => {
    const client = createQueryClient();
    const request = vi
      .spyOn(capacityClient, "getCapacity")
      .mockImplementation(async (_companyId, simulation) => ({
        ...response,
        estimatedHours: simulation.estimatedHours,
      }));
    const { result, rerender } = renderHook(
      ({ simulation }: { simulation: CapacitySimulationInput }) =>
        useCapacity(companyId, capabilities, simulation),
      { initialProps: { simulation: input }, wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.data?.estimatedHours).toBe(24));
    const nextInput = { ...input, estimatedHours: 25 };
    rerender({ simulation: nextInput });
    await waitFor(() => expect(result.current.data?.estimatedHours).toBe(25));
    expect(request).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(capacityKeys.simulation(companyId, input))).toMatchObject({
      estimatedHours: 24,
    });
    expect(client.getQueryData(capacityKeys.simulation(companyId, nextInput))).toMatchObject({
      estimatedHours: 25,
    });
  });

  it.each([
    [400, "VALIDATION_ERROR"],
    [404, "NOT_FOUND"],
    [422, "CAPACITY_CONFIGURATION_MISSING"],
    [500, "INTERNAL_ERROR"],
  ])("preserva erro HTTP %s sem cálculo local", async (status, code) => {
    const client = createQueryClient();
    const error = new ApiError({ status, code, message: "Erro" });
    const request = vi.spyOn(capacityClient, "getCapacity").mockRejectedValue(error);
    const { result } = renderHook(() => useCapacity(companyId, capabilities, input), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error).toBe(error);
    expect(request).toHaveBeenCalledWith(companyId, input, { signal: expect.any(AbortSignal) });
  });
});
