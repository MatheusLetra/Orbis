import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { capabilitiesKeys } from "@/features/companies/capabilities-keys";
import { ApiError } from "@/lib/http/api-error";
import { timelineClient } from "./timeline-client";
import { isValidWeekStart, type TimelineFilters } from "./timeline-contracts";
import { timelineKeys } from "./timeline-keys";

export function useWeeklyTimeline(
  companyId: string | null,
  weekStart: string,
  filters: TimelineFilters = {},
) {
  const queryClient = useQueryClient();
  const enabled = Boolean(companyId && isValidWeekStart(weekStart));
  const query = useQuery({
    queryKey: enabled
      ? timelineKeys.weekly(companyId as string, weekStart, filters)
      : ["timeline", "weekly", "disabled"],
    queryFn: ({ signal }) =>
      timelineClient.weekly(companyId as string, weekStart, filters, { signal }),
    enabled,
  });

  useEffect(() => {
    if (companyId && query.error instanceof ApiError && query.error.status === 403) {
      void queryClient.invalidateQueries({ queryKey: capabilitiesKeys.company(companyId) });
    }
  }, [companyId, query.error, queryClient]);

  return query;
}
