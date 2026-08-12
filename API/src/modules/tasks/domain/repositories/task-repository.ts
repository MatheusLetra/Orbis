import type { Task, TaskPriority, TaskStatus } from "@/modules/tasks/domain/entities/task";

export interface ListTasksFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  requisitionId?: string;
}

export interface TaskRepository {
  create(task: Task): Promise<Task>;
  findById(companyId: string, id: string): Promise<Task | null>;
  findByIdForUpdate(companyId: string, id: string): Promise<Task | null>;
  update(task: Task): Promise<Task>;
  listByCompany(companyId: string, filters?: ListTasksFilters): Promise<Task[]>;
}
