import { useQuery } from "@tanstack/react-query";
import { tasksClient } from "./task-client";
import type { TaskListFilters } from "./task-contracts";
import { taskKeys } from "./task-keys";

export function useTasks(companyId: string | null, filters: TaskListFilters = {}) {
  return useQuery({
    queryKey: companyId ? taskKeys.list(companyId, filters) : ["tasks", "disabled"],
    queryFn: ({ signal }) => tasksClient.list(companyId as string, filters, { signal }),
    enabled: Boolean(companyId),
  });
}

export function useTaskDetail(companyId: string | null, taskId: string | null) {
  return useQuery({
    queryKey:
      companyId && taskId ? taskKeys.detail(companyId, taskId) : ["tasks", "detail", "disabled"],
    queryFn: ({ signal }) => tasksClient.detail(companyId as string, taskId as string, { signal }),
    enabled: Boolean(companyId && taskId),
  });
}
