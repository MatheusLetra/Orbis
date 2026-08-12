import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import type {
  CreateTaskInput,
  TaskCard,
  TaskDetail,
  TaskListFilters,
  TaskOutput,
  TaskStatus,
  UpdateTaskInput,
} from "./task-contracts";
import { normalizeTaskFilters } from "./task-keys";

function queryString(filters: TaskListFilters): string {
  const params = new URLSearchParams();
  const normalized = normalizeTaskFilters(filters);
  for (const [key, value] of Object.entries(normalized)) {
    if (value !== undefined) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function path(companyId: string, suffix = ""): string {
  return `/companies/${encodeURIComponent(companyId)}/tasks${suffix}`;
}

export const tasksClient = {
  list(companyId: string, filters: TaskListFilters = {}, options?: Pick<RequestOptions, "signal">) {
    return apiClient.request<TaskCard[]>(`${path(companyId)}${queryString(filters)}`, options);
  },
  detail(companyId: string, taskId: string, options?: Pick<RequestOptions, "signal">) {
    return apiClient.request<TaskDetail>(
      path(companyId, `/${encodeURIComponent(taskId)}`),
      options,
    );
  },
  create(companyId: string, input: CreateTaskInput) {
    return apiClient.request<TaskOutput>(path(companyId), { method: "POST", body: input });
  },
  update(companyId: string, taskId: string, input: UpdateTaskInput) {
    return apiClient.request<TaskOutput>(path(companyId, `/${encodeURIComponent(taskId)}`), {
      method: "PATCH",
      body: input,
    });
  },
  transition(companyId: string, taskId: string, status: TaskStatus) {
    return apiClient.request<TaskOutput>(path(companyId, `/${encodeURIComponent(taskId)}/status`), {
      method: "PATCH",
      body: { status },
    });
  },
};
