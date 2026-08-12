import type { TaskListFilters } from "./task-contracts";

export function normalizeTaskFilters(
  filters: TaskListFilters = {},
): Required<Pick<TaskListFilters, "scope">> &
  Omit<TaskListFilters, "scope" | "search"> & { search?: string } {
  const search = filters.search?.trim() || undefined;
  return {
    scope: filters.scope ?? "company",
    status: filters.status,
    priority: filters.priority,
    assigneeId: filters.assigneeId,
    requisitionId: filters.requisitionId,
    search,
  };
}

export const taskKeys = {
  all: ["tasks"] as const,
  lists: (companyId: string) => [...taskKeys.all, "list", companyId] as const,
  list: (companyId: string, filters: TaskListFilters = {}) =>
    [...taskKeys.lists(companyId), normalizeTaskFilters(filters)] as const,
  detail: (companyId: string, taskId: string) =>
    [...taskKeys.all, "detail", companyId, taskId] as const,
};
