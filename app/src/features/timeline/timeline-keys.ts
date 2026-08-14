import type { TimelineFilters } from "./timeline-contracts";

export function normalizeTimelineFilters(filters: TimelineFilters = {}): TimelineFilters {
  return {
    assigneeId: filters.assigneeId || undefined,
    status: filters.status,
    priority: filters.priority,
  };
}

export const timelineKeys = {
  all: ["timeline"] as const,
  weeklyLists: (companyId: string) => [...timelineKeys.all, "weekly", companyId] as const,
  weekly: (companyId: string, weekStart: string, filters: TimelineFilters = {}) =>
    [...timelineKeys.weeklyLists(companyId), weekStart, normalizeTimelineFilters(filters)] as const,
};
