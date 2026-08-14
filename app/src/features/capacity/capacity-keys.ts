import type { CapacitySimulationInput } from "./capacity-contracts";

export const capacityKeys = {
  all: ["capacity"] as const,
  simulation: (companyId: string, input: CapacitySimulationInput) =>
    [...capacityKeys.all, "simulation", companyId, input.startDate, input.estimatedHours] as const,
};
