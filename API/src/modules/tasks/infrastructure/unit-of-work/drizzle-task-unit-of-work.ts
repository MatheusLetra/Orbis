import type { Database } from "@/infrastructure/database/client";
import type {
  TaskUnitOfWork,
  TaskUnitOfWorkRepositories,
} from "@/modules/tasks/application/ports/task-unit-of-work";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-repository";
import { DrizzleTaskStatusHistoryRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-status-history-repository";

export class DrizzleTaskUnitOfWork implements TaskUnitOfWork {
  constructor(private readonly db: Database) {}

  async execute<T>(work: (repositories: TaskUnitOfWorkRepositories) => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) => {
      const repositories: TaskUnitOfWorkRepositories = {
        tasks: new DrizzleTaskRepository(transaction),
        taskStatusHistory: new DrizzleTaskStatusHistoryRepository(transaction),
      };

      return work(repositories);
    });
  }
}
