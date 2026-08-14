import { useQuery } from "@tanstack/react-query";
import { monthlyTimelineClient } from "./monthly-client";
import type { MonthlyFilters } from "./monthly-contracts";
import { isValidMonthlyPeriod } from "./monthly-contracts";
import { monthlyTimelineKeys } from "./monthly-keys";

export function useMonthlyTimeline(
  companyId: string | null,
  period: string,
  filters: MonthlyFilters = {},
) {
  const enabled = Boolean(companyId && isValidMonthlyPeriod(period));
  return useQuery({
    queryKey: enabled
      ? monthlyTimelineKeys.list(companyId as string, period, filters)
      : ["timeline-monthly", "disabled"],
    queryFn: ({ signal }) =>
      monthlyTimelineClient.list(companyId as string, period, filters, { signal }),
    enabled,
  });
}
