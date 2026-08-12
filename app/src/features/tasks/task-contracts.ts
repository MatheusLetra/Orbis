export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskScope = "company" | "own";

export interface TaskSummary {
  id: string;
  name: string;
}

export interface RequisitionSummary {
  id: string;
  number: number;
  title: string;
}

export interface TaskOutput {
  id: string;
  companyId: string;
  requisitionId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCard extends TaskOutput {
  assignee: TaskSummary | null;
  requisition: RequisitionSummary | null;
}

export interface TaskStatusHistory {
  id: string;
  taskId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  changedBy: string;
  changedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface TaskDetail extends TaskOutput {
  history: TaskStatusHistory[];
}

export interface TaskListFilters {
  scope?: TaskScope;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  requisitionId?: string;
  search?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  requisitionId?: string;
  startDate?: string;
  plannedEndDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
  requisitionId?: string | null;
  startDate?: string | null;
  plannedEndDate?: string | null;
}
