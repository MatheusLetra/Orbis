import { and, asc, count, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import {
  memberships,
  requisitions,
  tasks,
  timeEntries,
  users,
} from "@/infrastructure/database/schema";
import type {
  TaskReportQuery,
  TaskReportQueryResult,
  TaskReportReadRepository,
} from "@/modules/reports/application/ports/task-report-read-repository";

export class DrizzleTaskReportReadRepository implements TaskReportReadRepository {
  constructor(private readonly db: Database) {}

  async find(query: TaskReportQuery): Promise<TaskReportQueryResult> {
    const conditions = [eq(tasks.companyId, query.companyId)];
    const entryConditions = [eq(timeEntries.companyId, query.companyId)];
    if (query.requisitionId) conditions.push(eq(tasks.requisitionId, query.requisitionId));
    if (query.employeeId) conditions.push(eq(tasks.assigneeId, query.employeeId));
    if (query.status) conditions.push(eq(tasks.status, query.status));
    if (query.priority) conditions.push(eq(tasks.priority, query.priority));
    if (query.periodStart && query.periodEnd) {
      const start = new Date(`${query.periodStart}T00:00:00.000Z`);
      const end = new Date(`${query.periodEnd}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      conditions.push(lt(tasks.createdAt, end));
      const overlap = or(
        gte(tasks.completedAt, start),
        gte(tasks.plannedEndDate, query.periodStart),
        and(isNull(tasks.completedAt), isNull(tasks.plannedEndDate)),
      );
      if (overlap) conditions.push(overlap);
      entryConditions.push(gte(timeEntries.createdAt, start), lt(timeEntries.createdAt, end));
    }
    const from = tasks;
    const rows = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        issuedAt: tasks.createdAt,
        plannedEndDate: tasks.plannedEndDate,
        completedAt: tasks.completedAt,
        assigneeId: users.id,
        assigneeName: users.name,
        requisitionId: requisitions.id,
        requisitionNumber: requisitions.number,
        requisitionTitle: requisitions.title,
        estimatedHours: requisitions.estimatedHours,
        workedMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)`,
      })
      .from(from)
      .leftJoin(
        memberships,
        and(
          eq(memberships.companyId, tasks.companyId),
          eq(memberships.userId, tasks.assigneeId),
          eq(memberships.isActive, true),
        ),
      )
      .leftJoin(users, and(eq(users.id, memberships.userId), eq(users.isActive, true)))
      .leftJoin(
        requisitions,
        and(eq(requisitions.id, tasks.requisitionId), eq(requisitions.companyId, tasks.companyId)),
      )
      .leftJoin(timeEntries, and(eq(timeEntries.taskId, tasks.id), ...entryConditions))
      .where(and(...conditions))
      .groupBy(
        tasks.id,
        users.id,
        users.name,
        requisitions.id,
        requisitions.number,
        requisitions.title,
        requisitions.estimatedHours,
      )
      .orderBy(asc(tasks.createdAt), asc(tasks.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    const totals = await this.db
      .select({ total: count() })
      .from(tasks)
      .where(and(...conditions));
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        priority: row.priority,
        issuedAt: row.issuedAt.toISOString(),
        plannedEndDate: row.plannedEndDate,
        completedAt: row.completedAt?.toISOString() ?? null,
        assigneeId: row.assigneeId ?? null,
        assigneeName: row.assigneeName ?? null,
        requisitionId: row.requisitionId ?? null,
        requisitionNumber: row.requisitionNumber ?? null,
        requisitionTitle: row.requisitionTitle ?? null,
        estimatedHours: row.estimatedHours === null ? null : Number(row.estimatedHours),
        workedHours: Number(row.workedMinutes ?? 0) / 60,
      })),
      total: Number(totals[0]?.total ?? 0),
    };
  }
}
