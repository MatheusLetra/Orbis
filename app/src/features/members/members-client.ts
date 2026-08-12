import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import type { CompanyMember, MemberListFilters } from "./members-contracts";
import { normalizeMemberFilters } from "./members-keys";

export const membersClient = {
  list(
    companyId: string,
    filters: MemberListFilters = {},
    options?: Pick<RequestOptions, "signal">,
  ) {
    const params = new URLSearchParams();
    const normalized = normalizeMemberFilters(filters);
    if (normalized.search) params.set("search", normalized.search);
    const query = params.toString();
    return apiClient.request<CompanyMember[]>(
      `/companies/${encodeURIComponent(companyId)}/members${query ? `?${query}` : ""}`,
      options,
    );
  },
};
