import { and, eq, gt, gte, isNull, lte, or } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { requisitions } from "@/infrastructure/database/schema";
import type {
  YearlyRequisitionTimelineQuery,
  YearlyRequisitionTimelineReadRepository,
} from "@/modules/timeline/application/ports/yearly-requisition-timeline-read-repository";

export class DrizzleYearlyRequisitionTimelineReadRepository
  implements YearlyRequisitionTimelineReadRepository
{
  constructor(private readonly db: Database) {}

  async findYearly(query: YearlyRequisitionTimelineQuery) {
    const conditions = [
      eq(requisitions.companyId, query.companyId),
      or(
        and(isNull(requisitions.startDate), isNull(requisitions.plannedDeliveryDate)),
        and(gt(requisitions.startDate, requisitions.plannedDeliveryDate)),
        and(
          or(
            isNull(requisitions.startDate),
            lte(requisitions.startDate, requisitions.plannedDeliveryDate),
          ),
          or(isNull(requisitions.startDate), lte(requisitions.startDate, query.yearEnd)),
          or(
            isNull(requisitions.plannedDeliveryDate),
            gte(requisitions.plannedDeliveryDate, query.yearStart),
          ),
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
      .orderBy(requisitions.plannedDeliveryDate, requisitions.title, requisitions.number);
    return rows.map((row) => ({
      ...row,
      estimatedHours: row.estimatedHours === null ? null : Number(row.estimatedHours),
    }));
  }
}
