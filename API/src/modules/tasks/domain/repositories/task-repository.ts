import type { Task, TaskPriority, TaskStatus } from "@/modules/tasks/domain/entities/task";

export interface TaskAssigneeSummary {
  id: string;
  name: string;
}

export interface TaskRequisitionSummary {
  id: string;
  number: number;
  title: string;
}

export interface TaskListItem {
  task: Task;
  assignee: TaskAssigneeSummary | null;
  requisition: TaskRequisitionSummary | null;
}

export interface ListTasksFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  requisitionId?: string;
  search?: string;
}

export interface TaskRepository {
  create(task: Task): Promise<Task>;
  findById(companyId: string, id: string): Promise<Task | null>;
  findByIdForUpdate(companyId: string, id: string): Promise<Task | null>;
  update(task: Task): Promise<Task>;
  listByCompany(companyId: string, filters?: ListTasksFilters): Promise<TaskListItem[]>;
}
