import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { capabilitiesKeys } from "@/features/companies/capabilities-keys";
import { ApiError } from "@/lib/http/api-error";
import { yearlyTimelineClient } from "./yearly-client";
import { isValidYear, type YearlyFilters } from "./yearly-contracts";
import { yearlyTimelineKeys } from "./yearly-keys";

export function useYearlyTimeline(
  companyId: string | null,
  year: string,
  filters: YearlyFilters = {},
) {
  const queryClient = useQueryClient();
  const enabled = Boolean(companyId && isValidYear(year));
  const query = useQuery({
    queryKey: enabled
      ? yearlyTimelineKeys.list(companyId as string, year, filters)
      : ["timeline-yearly", "disabled"],
    queryFn: ({ signal }) =>
      yearlyTimelineClient.list(companyId as string, year, filters, { signal }),
    enabled,
  });
  useEffect(() => {
    if (companyId && query.error instanceof ApiError && query.error.status === 403) {
      void queryClient.invalidateQueries({ queryKey: capabilitiesKeys.company(companyId) });
    }
  }, [companyId, query.error, queryClient]);
  return query;
}
