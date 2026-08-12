import { useQuery } from "@tanstack/react-query";
import { requisitionsClient } from "./requisition-client";
import type { RequisitionListFilters } from "./requisition-contracts";
import { requisitionKeys } from "./requisition-keys";

export function useRequisitions(companyId: string | null, filters: RequisitionListFilters = {}) {
  return useQuery({
    queryKey: companyId ? requisitionKeys.list(companyId, filters) : ["requisitions", "disabled"],
    queryFn: ({ signal }) => requisitionsClient.list(companyId as string, filters, { signal }),
    enabled: Boolean(companyId),
  });
}
