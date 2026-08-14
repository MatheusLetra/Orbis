import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { ApiError } from "@/lib/http/api-error";
import { capacityClient } from "./capacity-client";

const input = { startDate: "2026-08-17T00:00:00.000Z", estimatedHours: 24 };
const response = {
  companyId: "11111111-1111-4111-8111-111111111111",
  ...input,
  availableDevelopers: 3,
  dailyHoursPerDeveloper: 8,
  dailyCapacity: 24,
  requiredDays: 1,
  plannedDeliveryDate: "2026-08-18T00:00:00.000Z",
};

describe("capacityClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("usa endpoint tenant-aware, envia parâmetros e repassa AbortSignal", async () => {
    const signal = new AbortController().signal;
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(response);

    await expect(capacityClient.getCapacity("company/a", input, { signal })).resolves.toEqual(
      response,
    );
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/capacity?startDate=2026-08-17T00%3A00%3A00.000Z&estimatedHours=24",
      { signal },
    );
  });

  it("preserva ApiError da API", async () => {
    const error = new ApiError({ status: 422, code: "CAPACITY_ZERO", message: "Sem capacidade" });
    vi.spyOn(apiClient, "request").mockRejectedValue(error);

    await expect(capacityClient.getCapacity(response.companyId, input)).rejects.toBe(error);
  });

  it("rejeita resposta fora do contrato", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue({});

    await expect(capacityClient.getCapacity(response.companyId, input)).rejects.toThrow(
      "Contrato de capacidade inválido",
    );
  });
});
