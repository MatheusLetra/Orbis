import { useQuery } from "@tanstack/react-query";
import { membersClient } from "./members-client";
import type { MemberListFilters } from "./members-contracts";
import { memberKeys } from "./members-keys";

export function useCompanyMembers(companyId: string | null, filters: MemberListFilters = {}) {
  return useQuery({
    queryKey: companyId ? memberKeys.list(companyId, filters) : ["members", "disabled"],
    queryFn: ({ signal }) => membersClient.list(companyId as string, filters, { signal }),
    enabled: Boolean(companyId),
  });
}
