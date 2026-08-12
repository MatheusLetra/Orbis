import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { taskStatusHistory, tasks } from "@/infrastructure/database/schema";
import type { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import { TaskStatusHistory as TaskStatusHistoryEntity } from "@/modules/tasks/domain/entities/task-status-history";
import type { TaskStatusHistoryRepository } from "@/modules/tasks/domain/repositories/task-status-history-repository";
import { requireRow } from "@/shared/utils/require-row";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;
type Uuid = `${string}-${string}-${string}-${string}-${string}`;

function toEntity(row: typeof taskStatusHistory.$inferSelect): TaskStatusHistory {
  if (row.changedBy === null) {
    throw new Error("Histórico de status sem changedBy");
  }

  if (row.fromStatus === null) {
    if (row.toStatus !== "TODO") {
      throw new Error("Histórico inicial de status inválido");
    }

    return TaskStatusHistoryEntity.createInitial(
      {
        taskId: row.taskId,
        changedBy: row.changedBy,
        changedAt: row.changedAt,
        metadata: row.metadata,
      },
      row.id as Uuid,
    );
  }

  return TaskStatusHistoryEntity.createTransition(
    {
      taskId: row.taskId,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      changedBy: row.changedBy,
      changedAt: row.changedAt,
      metadata: row.metadata,
    },
    row.id as Uuid,
  );
}

function toInsertValues(history: TaskStatusHistory) {
  return {
    id: history.id,
    taskId: history.taskId,
    fromStatus: history.fromStatus,
    toStatus: history.toStatus,
    changedBy: history.changedBy,
    changedAt: history.changedAt,
    metadata: history.metadata,
  };
}

export class DrizzleTaskStatusHistoryRepository implements TaskStatusHistoryRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(history: TaskStatusHistory): Promise<TaskStatusHistory> {
    const rows = await this.db
      .insert(taskStatusHistory)
      .values(toInsertValues(history))
      .returning();

    return toEntity(requireRow(rows[0]));
  }

  async listByTask(companyId: string, taskId: string): Promise<TaskStatusHistory[]> {
    const rows = await this.db
      .select({ history: taskStatusHistory })
      .from(taskStatusHistory)
      .innerJoin(tasks, eq(tasks.id, taskStatusHistory.taskId))
      .where(and(eq(tasks.companyId, companyId), eq(tasks.id, taskId)))
      .orderBy(asc(taskStatusHistory.changedAt), asc(taskStatusHistory.id));

    return rows.map(({ history }) => toEntity(history));
  }
}
