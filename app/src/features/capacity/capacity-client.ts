import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import { type CapacitySimulationInput, parseCapacitySimulationOutput } from "./capacity-contracts";

export const capacityClient = {
  getCapacity(
    companyId: string,
    input: CapacitySimulationInput,
    options?: Pick<RequestOptions, "signal">,
  ) {
    const params = new URLSearchParams({
      startDate: input.startDate,
      estimatedHours: String(input.estimatedHours),
    });
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/capacity?${params.toString()}`,
        options,
      )
      .then(parseCapacitySimulationOutput);
  },
};
