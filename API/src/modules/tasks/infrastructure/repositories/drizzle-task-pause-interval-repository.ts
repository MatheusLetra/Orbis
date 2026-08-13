import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { taskPauseIntervals } from "@/infrastructure/database/schema";
import type { TaskPauseInterval } from "@/modules/tasks/domain/entities/task-pause-interval";
import { TaskPauseInterval as TaskPauseIntervalEntity } from "@/modules/tasks/domain/entities/task-pause-interval";
import type { TaskPauseIntervalRepository } from "@/modules/tasks/domain/repositories/task-pause-interval-repository";
import { BusinessRuleError } from "@/shared/errors/typed-errors";
import { requireRow } from "@/shared/utils/require-row";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

function toEntity(row: typeof taskPauseIntervals.$inferSelect): TaskPauseInterval {
  return TaskPauseIntervalEntity.restore({
    id: row.id,
    taskId: row.taskId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationSeconds: row.durationSeconds,
  });
}

export class DrizzleTaskPauseIntervalRepository implements TaskPauseIntervalRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(interval: TaskPauseInterval): Promise<TaskPauseInterval> {
    const rows = await this.db
      .insert(taskPauseIntervals)
      .values({
        id: interval.id,
        taskId: interval.taskId,
        startedAt: interval.startedAt,
        endedAt: interval.endedAt,
        durationSeconds: interval.durationSeconds,
      })
      .returning();

    return toEntity(requireRow(rows[0]));
  }

  async findOpenByTaskForUpdate(taskId: string): Promise<TaskPauseInterval | null> {
    const rows = await this.db
      .select()
      .from(taskPauseIntervals)
      .where(and(eq(taskPauseIntervals.taskId, taskId), isNull(taskPauseIntervals.endedAt)))
      .for("update");

    if (rows.length > 1) {
      throw new BusinessRuleError("Task possui múltiplos intervalos de pausa abertos");
    }

    return rows[0] ? toEntity(rows[0]) : null;
  }

  async close(interval: TaskPauseInterval): Promise<TaskPauseInterval> {
    const rows = await this.db
      .update(taskPauseIntervals)
      .set({ endedAt: interval.endedAt, durationSeconds: interval.durationSeconds })
      .where(
        and(
          eq(taskPauseIntervals.id, interval.id),
          eq(taskPauseIntervals.taskId, interval.taskId),
          isNull(taskPauseIntervals.endedAt),
        ),
      )
      .returning();

    return toEntity(requireRow(rows[0]));
  }
}
