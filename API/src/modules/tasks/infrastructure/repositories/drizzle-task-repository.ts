import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { memberships, requisitions, tasks, users } from "@/infrastructure/database/schema";
import type { Task } from "@/modules/tasks/domain/entities/task";
import { Task as TaskEntity } from "@/modules/tasks/domain/entities/task";
import type {
  ListTasksFilters,
  TaskListItem,
  TaskRepository,
} from "@/modules/tasks/domain/repositories/task-repository";
import { requireRow } from "@/shared/utils/require-row";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

function toCalendarDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function toEntity(row: typeof tasks.$inferSelect): Task {
  return TaskEntity.restore({
    id: row.id,
    companyId: row.companyId,
    requisitionId: row.requisitionId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assigneeId: row.assigneeId,
    startDate: toCalendarDate(row.startDate),
    plannedEndDate: toCalendarDate(row.plannedEndDate),
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toInsertValues(task: Task) {
  return {
    id: task.id,
    companyId: task.companyId,
    requisitionId: task.requisitionId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    assigneeId: task.assigneeId,
    startDate: task.startDate?.toISOString().slice(0, 10) ?? null,
    plannedEndDate: task.plannedEndDate?.toISOString().slice(0, 10) ?? null,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export class DrizzleTaskRepository implements TaskRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(task: Task): Promise<Task> {
    const rows = await this.db.insert(tasks).values(toInsertValues(task)).returning();

    return toEntity(requireRow(rows[0]));
  }

  async findById(companyId: string, id: string): Promise<Task | null> {
    const row = (
      await this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.companyId, companyId), eq(tasks.id, id)))
    )[0];

    return row ? toEntity(row) : null;
  }

  async findByIdForUpdate(companyId: string, id: string): Promise<Task | null> {
    const row = (
      await this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.companyId, companyId), eq(tasks.id, id)))
        .for("update")
    )[0];

    return row ? toEntity(row) : null;
  }

  async update(task: Task): Promise<Task> {
    const rows = await this.db
      .update(tasks)
      .set(toInsertValues(task))
      .where(and(eq(tasks.companyId, task.companyId), eq(tasks.id, task.id)))
      .returning();

    return toEntity(requireRow(rows[0]));
  }

  async listByCompany(companyId: string, filters: ListTasksFilters = {}): Promise<TaskListItem[]> {
    const conditions = [eq(tasks.companyId, companyId)];

    if (filters.status !== undefined) {
      conditions.push(eq(tasks.status, filters.status));
    }
    if (filters.priority !== undefined) {
      conditions.push(eq(tasks.priority, filters.priority));
    }
    if (filters.assigneeId !== undefined) {
      conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    }
    if (filters.requisitionId !== undefined) {
      conditions.push(eq(tasks.requisitionId, filters.requisitionId));
    }

    if (filters.search !== undefined) {
      conditions.push(
        sql`${tasks.title} ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'`,
      );
    }

    const rows = await this.db
      .select({
        task: tasks,
        assigneeId: users.id,
        assigneeName: users.name,
        requisitionId: requisitions.id,
        requisitionNumber: requisitions.number,
        requisitionTitle: requisitions.title,
      })
      .from(tasks)
      .leftJoin(
        memberships,
        and(eq(memberships.companyId, tasks.companyId), eq(memberships.userId, tasks.assigneeId)),
      )
      .leftJoin(users, eq(users.id, memberships.userId))
      .leftJoin(
        requisitions,
        and(eq(requisitions.id, tasks.requisitionId), eq(requisitions.companyId, tasks.companyId)),
      )
      .where(and(...conditions))
      .orderBy(asc(tasks.createdAt), asc(tasks.id));

    return rows.map((row) => ({
      task: toEntity(row.task),
      assignee:
        row.assigneeId && row.assigneeName ? { id: row.assigneeId, name: row.assigneeName } : null,
      requisition:
        row.requisitionId && row.requisitionNumber !== null && row.requisitionTitle !== null
          ? {
              id: row.requisitionId,
              number: row.requisitionNumber,
              title: row.requisitionTitle,
            }
          : null,
    }));
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
