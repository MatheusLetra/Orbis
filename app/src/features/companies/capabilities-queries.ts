import { useQuery } from "@tanstack/react-query";
import { capabilitiesClient } from "./capabilities-client";
import { capabilitiesKeys } from "./capabilities-keys";

export function useCompanyCapabilities(companyId: string | null) {
  return useQuery({
    queryKey: companyId
      ? capabilitiesKeys.company(companyId)
      : ["company-capabilities", "disabled"],
    queryFn: ({ signal }) => capabilitiesClient.get(companyId as string, { signal }),
    enabled: Boolean(companyId),
  });
}
