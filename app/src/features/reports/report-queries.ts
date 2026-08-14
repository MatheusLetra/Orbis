import { useQuery } from "@tanstack/react-query";
import { reportClient } from "./report-client";
import type { TaskReportFilters } from "./report-contracts";
import { reportKeys } from "./report-keys";
export function useTaskReport(companyId: string | null, filters: TaskReportFilters, page: number) {
  const enabled = Boolean(companyId && page >= 1);
  return useQuery({
    queryKey: enabled
      ? reportKeys.list(companyId as string, page, filters)
      : ["reports", "tasks", "disabled"],
    queryFn: ({ signal }) => reportClient.list(companyId as string, filters, page, { signal }),
    enabled,
  });
}
