import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { TaskStatusHistoryRepository } from "@/modules/tasks/domain/repositories/task-status-history-repository";

export interface TaskUnitOfWorkRepositories {
  tasks: TaskRepository;
  taskStatusHistory: TaskStatusHistoryRepository;
}

export interface TaskUnitOfWork {
  execute<T>(work: (repositories: TaskUnitOfWorkRepositories) => Promise<T>): Promise<T>;
}
