import { and, asc, eq, or, sql } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { requisitions } from "@/infrastructure/database/schema";
import type { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import { Requisition as RequisitionEntity } from "@/modules/requisitions/domain/entities/requisition";
import type {
  ListRequisitionsFilters,
  RequisitionRepository,
} from "@/modules/requisitions/domain/repositories/requisition-repository";
import { requireRow } from "@/shared/utils/require-row";

function toCalendarDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function toEntity(row: typeof requisitions.$inferSelect): Requisition {
  return RequisitionEntity.restore({
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    requesterId: row.requesterId,
    responsibleId: row.responsibleId,
    systemId: row.systemId,
    systemVersionId: row.systemVersionId,
    estimatedHours: row.estimatedHours === null ? null : Number(row.estimatedHours),
    startDate: toCalendarDate(row.startDate),
    plannedDeliveryDate: toCalendarDate(row.plannedDeliveryDate),
    deliveredAt: row.deliveredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toInsertValues(requisition: Requisition) {
  return {
    id: requisition.id,
    companyId: requisition.companyId,
    number: requisition.number,
    title: requisition.title,
    description: requisition.description,
    priority: requisition.priority,
    status: requisition.status,
    requesterId: requisition.requesterId,
    responsibleId: requisition.responsibleId,
    systemId: requisition.systemId,
    systemVersionId: requisition.systemVersionId,
    estimatedHours: requisition.estimatedHours?.toString() ?? null,
    startDate: requisition.startDate?.toISOString().slice(0, 10) ?? null,
    plannedDeliveryDate: requisition.plannedDeliveryDate?.toISOString().slice(0, 10) ?? null,
    deliveredAt: requisition.deliveredAt,
    createdAt: requisition.createdAt,
    updatedAt: requisition.updatedAt,
  };
}

export class DrizzleRequisitionRepository implements RequisitionRepository {
  constructor(private readonly db: Database) {}

  async create(requisition: Requisition): Promise<Requisition> {
    const rows = await this.db.insert(requisitions).values(toInsertValues(requisition)).returning();

    return toEntity(requireRow(rows[0]));
  }

  async findById(id: string): Promise<Requisition | null> {
    const row = (await this.db.select().from(requisitions).where(eq(requisitions.id, id)))[0];

    return row ? toEntity(row) : null;
  }

  async update(requisition: Requisition): Promise<Requisition> {
    const rows = await this.db
      .update(requisitions)
      .set(toInsertValues(requisition))
      .where(eq(requisitions.id, requisition.id))
      .returning();

    return toEntity(requireRow(rows[0]));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(requisitions).where(eq(requisitions.id, id));
  }

  async listByCompany(
    companyId: string,
    filters: ListRequisitionsFilters = {},
  ): Promise<Requisition[]> {
    const conditions = [eq(requisitions.companyId, companyId)];

    if (filters.status !== undefined) {
      conditions.push(eq(requisitions.status, filters.status));
    }
    if (filters.priority !== undefined) {
      conditions.push(eq(requisitions.priority, filters.priority));
    }
    if (filters.responsibleId !== undefined) {
      conditions.push(eq(requisitions.responsibleId, filters.responsibleId));
    }
    const normalizedSearch = filters.search?.trim();
    if (normalizedSearch) {
      const titleSearch = sql`${requisitions.title} ILIKE ${`%${escapeLikePattern(normalizedSearch)}%`} ESCAPE '\\'`;
      const numericSearch = /^\d+$/.test(normalizedSearch)
        ? eq(requisitions.number, Number(normalizedSearch))
        : undefined;
      conditions.push(
        numericSearch ? (or(titleSearch, numericSearch) ?? titleSearch) : titleSearch,
      );
    }

    const rows = await this.db
      .select()
      .from(requisitions)
      .where(and(...conditions))
      .orderBy(asc(requisitions.createdAt));

    return rows.map(toEntity);
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
