import type { MonthlyFilters } from "./monthly-contracts";

export function normalizeMonthlyFilters(filters: MonthlyFilters = {}): MonthlyFilters {
  return {
    priority: filters.priority,
    assigneeId: filters.assigneeId || undefined,
    status: filters.status,
  };
}

export const monthlyTimelineKeys = {
  all: ["timeline-monthly"] as const,
  lists: (companyId: string) => [...monthlyTimelineKeys.all, companyId] as const,
  list: (companyId: string, period: string, filters: MonthlyFilters = {}) =>
    [...monthlyTimelineKeys.lists(companyId), period, normalizeMonthlyFilters(filters)] as const,
};
