import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import type { Requisition, RequisitionListFilters } from "./requisition-contracts";
import { normalizeRequisitionFilters } from "./requisition-keys";

export const requisitionsClient = {
  list(
    companyId: string,
    filters: RequisitionListFilters = {},
    options?: Pick<RequestOptions, "signal">,
  ) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(normalizeRequisitionFilters(filters))) {
      if (value !== undefined) params.set(key, value);
    }
    const query = params.toString();
    return apiClient.request<Requisition[]>(
      `/companies/${encodeURIComponent(companyId)}/requisitions${query ? `?${query}` : ""}`,
      options,
    );
  },
};
