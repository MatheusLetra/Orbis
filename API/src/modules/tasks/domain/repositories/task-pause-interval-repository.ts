import type { TaskPauseInterval } from "@/modules/tasks/domain/entities/task-pause-interval";

export interface TaskPauseIntervalRepository {
  create(interval: TaskPauseInterval): Promise<TaskPauseInterval>;
  findOpenByTaskForUpdate(taskId: string): Promise<TaskPauseInterval | null>;
  close(interval: TaskPauseInterval): Promise<TaskPauseInterval>;
}
