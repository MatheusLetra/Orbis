import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/http/api-client";
import { tasksClient } from "./task-client";
import type { TaskListFilters } from "./task-contracts";
import { taskKeys } from "./task-keys";

export interface TaskLookupMember {
  userId: string;
  name: string;
}
export interface TaskLookupRequisition {
  id: string;
  number: number;
  title: string;
}

export function useTaskLookups(
  companyId: string | null,
  enabled = true,
  capabilities: { members: boolean; requisitions: boolean } = { members: true, requisitions: true },
) {
  return useQuery({
    queryKey: ["tasks", "lookups", companyId ?? "disabled", capabilities],
    queryFn: async () => {
      const root = `/companies/${encodeURIComponent(companyId as string)}`;
      const [members, requisitions] = await Promise.all([
        capabilities.members
          ? apiClient.request<Array<{ userId: string; name: string }>>(`${root}/members`)
          : Promise.resolve([]),
        capabilities.requisitions
          ? apiClient.request<TaskLookupRequisition[]>(`${root}/requisitions`)
          : Promise.resolve([]),
      ]);
      return { members, requisitions };
    },
    enabled: Boolean(companyId && enabled),
  });
}

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
