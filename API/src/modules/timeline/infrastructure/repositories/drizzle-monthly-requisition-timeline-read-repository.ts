import { and, asc, eq, gt, gte, isNull, lt, lte, or } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { requisitions } from "@/infrastructure/database/schema";
import type {
  MonthlyRequisitionTimelineQuery,
  MonthlyRequisitionTimelineReadRepository,
} from "@/modules/timeline/application/ports/monthly-requisition-timeline-read-repository";

export class DrizzleMonthlyRequisitionTimelineReadRepository
  implements MonthlyRequisitionTimelineReadRepository
{
  constructor(private readonly db: Database) {}

  async findMonthly(query: MonthlyRequisitionTimelineQuery) {
    const conditions = [
      eq(requisitions.companyId, query.companyId),
      or(
        and(isNull(requisitions.startDate), isNull(requisitions.plannedDeliveryDate)),
        and(gt(requisitions.startDate, requisitions.plannedDeliveryDate)),
        and(
          isNull(requisitions.deliveredAt),
          lt(requisitions.plannedDeliveryDate, query.periodStart),
        ),
        and(
          lte(requisitions.startDate, query.periodEnd),
          gte(requisitions.plannedDeliveryDate, query.periodStart),
        ),
        and(
          isNull(requisitions.startDate),
          gte(requisitions.plannedDeliveryDate, query.periodStart),
          lte(requisitions.plannedDeliveryDate, query.periodEnd),
        ),
        and(
          isNull(requisitions.plannedDeliveryDate),
          gte(requisitions.startDate, query.periodStart),
          lte(requisitions.startDate, query.periodEnd),
        ),
      ),
    ];
    if (query.priority) conditions.push(eq(requisitions.priority, query.priority));
    if (query.assigneeId) conditions.push(eq(requisitions.responsibleId, query.assigneeId));
    if (query.status) conditions.push(eq(requisitions.status, query.status));
    const rows = await this.db
      .select({
        requisitionId: requisitions.id,
        number: requisitions.number,
        title: requisitions.title,
        priority: requisitions.priority,
        assigneeId: requisitions.responsibleId,
        startDate: requisitions.startDate,
        plannedDeliveryDate: requisitions.plannedDeliveryDate,
        deliveredAt: requisitions.deliveredAt,
        estimatedHours: requisitions.estimatedHours,
      })
      .from(requisitions)
      .where(and(...conditions))
      .orderBy(
        asc(requisitions.startDate),
        asc(requisitions.plannedDeliveryDate),
        asc(requisitions.id),
      );
    return rows.map((row) => ({
      ...row,
      estimatedHours: row.estimatedHours === null ? null : Number(row.estimatedHours),
    }));
  }
}
