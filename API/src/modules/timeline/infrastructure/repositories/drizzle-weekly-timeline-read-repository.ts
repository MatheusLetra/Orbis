import { and, asc, eq, gt, gte, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { memberships, tasks, users } from "@/infrastructure/database/schema";
import type {
  WeeklyTimelineQuery,
  WeeklyTimelineQueryResult,
  WeeklyTimelineReadRepository,
} from "@/modules/timeline/application/ports/weekly-timeline-read-repository";

export class DrizzleWeeklyTimelineReadRepository implements WeeklyTimelineReadRepository {
  constructor(private readonly db: Database) {}

  async findWeekly(query: WeeklyTimelineQuery): Promise<WeeklyTimelineQueryResult> {
    const conditions = [
      eq(tasks.companyId, query.companyId),
      or(
        and(isNull(tasks.startDate), isNull(tasks.plannedEndDate)),
        and(
          isNotNull(tasks.startDate),
          isNotNull(tasks.plannedEndDate),
          gt(tasks.startDate, tasks.plannedEndDate),
        ),
        and(lt(tasks.plannedEndDate, query.weekStart), ne(tasks.status, "DONE")),
        and(
          lte(sql`coalesce(${tasks.startDate}, ${tasks.plannedEndDate})`, query.weekEnd),
          gte(sql`coalesce(${tasks.plannedEndDate}, ${tasks.startDate})`, query.weekStart),
        ),
      ),
    ];
    if (query.assigneeId !== undefined) conditions.push(eq(tasks.assigneeId, query.assigneeId));
    if (query.status !== undefined) conditions.push(eq(tasks.status, query.status));
    if (query.priority !== undefined) conditions.push(eq(tasks.priority, query.priority));

    const [taskRows, assigneeRows] = await Promise.all([
      this.db
        .select({
          id: tasks.id,
          companyId: tasks.companyId,
          requisitionId: tasks.requisitionId,
          title: tasks.title,
          description: tasks.description,
          priority: tasks.priority,
          status: tasks.status,
          startDate: tasks.startDate,
          plannedEndDate: tasks.plannedEndDate,
          assigneeId: tasks.assigneeId,
          completedAt: tasks.completedAt,
        })
        .from(tasks)
        .where(and(...conditions))
        .orderBy(
          sql`${tasks.startDate} asc nulls last`,
          sql`${tasks.plannedEndDate} asc nulls last`,
          sql`case ${tasks.priority} when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end`,
          asc(tasks.title),
          asc(tasks.id),
        ),
      this.db
        .selectDistinct({ id: users.id, name: users.name })
        .from(tasks)
        .innerJoin(
          memberships,
          and(
            eq(memberships.companyId, tasks.companyId),
            eq(memberships.userId, tasks.assigneeId),
            eq(memberships.isActive, true),
          ),
        )
        .innerJoin(users, and(eq(users.id, memberships.userId), eq(users.isActive, true)))
        .where(eq(tasks.companyId, query.companyId))
        .orderBy(asc(users.name), asc(users.id)),
    ]);

    return {
      tasks: taskRows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        requisitionId: row.requisitionId,
        title: row.title,
        description: row.description,
        priority: row.priority,
        status: row.status,
        startDate: row.startDate,
        plannedEndDate: row.plannedEndDate,
        assigneeId: row.assigneeId,
        completedAt: row.completedAt?.toISOString() ?? null,
      })),
      assignees: assigneeRows,
    };
  }
}
