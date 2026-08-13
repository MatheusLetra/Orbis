import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import { parseCompanyCapabilities } from "./capabilities-contracts";

export const capabilitiesClient = {
  get(companyId: string, options?: Pick<RequestOptions, "signal">) {
    return apiClient
      .request<unknown>(`/companies/${encodeURIComponent(companyId)}/capabilities`, options)
      .then(parseCompanyCapabilities);
  },
};
