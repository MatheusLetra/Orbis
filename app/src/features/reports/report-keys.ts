import type { TaskReportFilters } from "./report-contracts";
export function normalizeReportFilters(filters: TaskReportFilters): TaskReportFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""),
  ) as TaskReportFilters;
}
export const reportKeys = {
  all: ["reports", "tasks"] as const,
  lists: (companyId: string) => [...reportKeys.all, companyId] as const,
  list: (companyId: string, page: number, filters: TaskReportFilters) =>
    [...reportKeys.lists(companyId), page, normalizeReportFilters(filters)] as const,
};
