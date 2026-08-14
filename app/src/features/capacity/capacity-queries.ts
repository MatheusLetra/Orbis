import { useQuery } from "@tanstack/react-query";
import type { CompanyCapabilities } from "@/features/companies/capabilities-contracts";
import { ApiError } from "@/lib/http/api-error";
import { capacityClient } from "./capacity-client";
import {
  type CapacitySimulationInput,
  type CapacitySimulationOutput,
  isUuid,
  isValidCapacitySimulationInput,
} from "./capacity-contracts";
import { capacityKeys } from "./capacity-keys";

export interface UseCapacityOptions {
  enabled?: boolean;
  onForbidden?: () => void;
}

export function useCapacity(
  companyId: string | null,
  capabilities: CompanyCapabilities | null | undefined,
  input: CapacitySimulationInput | null,
  options: UseCapacityOptions = {},
) {
  const hasCapability =
    capabilities?.companyId === companyId && capabilities.capabilities["capacity.read"] === true;
  const validCompanyId = isUuid(companyId);
  const validInput = isValidCapacitySimulationInput(input);
  const enabled = Boolean(
    validCompanyId && hasCapability && validInput && options.enabled !== false,
  );

  return useQuery<CapacitySimulationOutput, Error>({
    queryKey:
      enabled && input
        ? capacityKeys.simulation(companyId as string, input)
        : ["capacity", "simulation", "disabled"],
    queryFn: ({ signal }) =>
      capacityClient
        .getCapacity(companyId as string, input as CapacitySimulationInput, { signal })
        .catch((error) => {
          if (error instanceof ApiError && error.status === 403) options.onForbidden?.();
          throw error;
        }),
    enabled,
  });
}
