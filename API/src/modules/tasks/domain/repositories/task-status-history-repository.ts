import type { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";

export interface TaskStatusHistoryRepository {
  create(history: TaskStatusHistory): Promise<TaskStatusHistory>;
  listByTask(companyId: string, taskId: string): Promise<TaskStatusHistory[]>;
}
