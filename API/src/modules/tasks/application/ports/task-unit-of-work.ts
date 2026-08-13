import type { TaskPauseIntervalRepository } from "@/modules/tasks/domain/repositories/task-pause-interval-repository";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { TaskStatusHistoryRepository } from "@/modules/tasks/domain/repositories/task-status-history-repository";
import type { TimeEntryRepository } from "@/modules/tasks/domain/repositories/time-entry-repository";

export interface TaskUnitOfWorkRepositories {
  tasks: TaskRepository;
  taskStatusHistory: TaskStatusHistoryRepository;
  taskPauseIntervals: TaskPauseIntervalRepository;
  timeEntries: TimeEntryRepository;
}

export interface TaskUnitOfWork {
  execute<T>(work: (repositories: TaskUnitOfWorkRepositories) => Promise<T>): Promise<T>;
}
