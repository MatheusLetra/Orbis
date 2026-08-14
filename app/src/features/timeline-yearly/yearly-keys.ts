import type { YearlyFilters } from "./yearly-contracts";

export function normalizeYearlyFilters(filters: YearlyFilters = {}): YearlyFilters {
  return {
    priority: filters.priority,
    assigneeId: filters.assigneeId || undefined,
    status: filters.status,
  };
}

export const yearlyTimelineKeys = {
  all: ["timeline-yearly"] as const,
  lists: (companyId: string) => [...yearlyTimelineKeys.all, companyId] as const,
  list: (companyId: string, year: string, filters: YearlyFilters = {}) =>
    [...yearlyTimelineKeys.lists(companyId), year, normalizeYearlyFilters(filters)] as const,
};
