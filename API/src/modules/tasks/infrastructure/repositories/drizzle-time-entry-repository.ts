import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { timeEntries } from "@/infrastructure/database/schema";
import type { TimeEntry } from "@/modules/tasks/domain/entities/time-entry";
import { TimeEntry as TimeEntryEntity } from "@/modules/tasks/domain/entities/time-entry";
import type { TimeEntryRepository } from "@/modules/tasks/domain/repositories/time-entry-repository";
import { requireRow } from "@/shared/utils/require-row";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

function toEntity(row: typeof timeEntries.$inferSelect): TimeEntry {
  return TimeEntryEntity.restore({
    id: row.id,
    companyId: row.companyId,
    taskId: row.taskId,
    userId: row.userId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMinutes: row.durationMinutes,
    description: row.description,
    createdAt: row.createdAt,
  });
}

export class DrizzleTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(entry: TimeEntry): Promise<TimeEntry> {
    const rows = await this.db
      .insert(timeEntries)
      .values({
        id: entry.id,
        companyId: entry.companyId,
        taskId: entry.taskId,
        userId: entry.userId,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        durationMinutes: entry.durationMinutes,
        description: entry.description,
        createdAt: entry.createdAt,
      })
      .returning();

    return toEntity(requireRow(rows[0]));
  }

  async listByTask(companyId: string, taskId: string, limit: number): Promise<TimeEntry[]> {
    const rows = await this.db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.taskId, taskId)))
      .orderBy(asc(timeEntries.createdAt), asc(timeEntries.id))
      .limit(limit);

    return rows.map(toEntity);
  }

  async sumDurationByTask(companyId: string, taskId: string): Promise<number> {
    const rows = await this.db
      .select({ total: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)` })
      .from(timeEntries)
      .where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.taskId, taskId)));

    return Number(rows[0]?.total ?? 0);
  }
}
