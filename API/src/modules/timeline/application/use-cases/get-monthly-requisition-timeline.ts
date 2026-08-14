import { z } from "zod";

import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  REQUISITION_PRIORITIES,
  REQUISITION_STATUSES,
} from "@/modules/requisitions/domain/entities/requisition";
import type {
  MonthlyRequisitionTimelineReadRepository,
  MonthlyRequisitionTimelineRow,
} from "@/modules/timeline/application/ports/monthly-requisition-timeline-read-repository";
import type {
  MonthlyRequisitionTimelineItem,
  MonthlyRequisitionTimelineReadModel,
} from "@/modules/timeline/application/read-models/monthly-requisition-timeline";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

const monthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;
const inputSchema = z
  .object({
    companyId: z.string().uuid(),
    period: z.string().regex(monthPattern),
    priority: z.enum(REQUISITION_PRIORITIES).optional(),
    assigneeId: z.string().uuid().optional(),
    status: z.enum(REQUISITION_STATUSES).optional(),
  })
  .strict();

export interface GetMonthlyRequisitionTimelineCommand {
  actor: AuthenticatedUser;
  companyId: string;
  period: string;
  filters?: {
    priority?: (typeof REQUISITION_PRIORITIES)[number];
    assigneeId?: string;
    status?: (typeof REQUISITION_STATUSES)[number];
  };
}

export class GetMonthlyRequisitionTimeline
  implements UseCase<GetMonthlyRequisitionTimelineCommand, MonthlyRequisitionTimelineReadModel>
{
  constructor(
    private readonly repository: MonthlyRequisitionTimelineReadRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(
    input: GetMonthlyRequisitionTimelineCommand,
  ): Promise<MonthlyRequisitionTimelineReadModel> {
    const parsed = inputSchema.safeParse({
      companyId: input.companyId,
      period: input.period,
      ...input.filters,
    });
    if (!parsed.success)
      throw new ValidationError("Filtros da timeline mensal inválidos", {
        details: { issues: parsed.error.issues },
      });
    this.authorization.assertCompanyContext(input.actor, parsed.data.companyId);
    this.authorization.assertPermission(input.actor, "requisitions.read");
    await this.accessService.assertAccess(input.actor.userId, parsed.data.companyId);
    const company = await this.companyRepository.findById(parsed.data.companyId);
    if (!company?.isActive) throw new NotFoundError("Empresa não encontrada");

    const periodStart = `${parsed.data.period}-01`;
    const periodEnd = new Date(
      Date.UTC(Number(parsed.data.period.slice(0, 4)), Number(parsed.data.period.slice(5, 7)), 0),
    )
      .toISOString()
      .slice(0, 10);
    const rows = await this.repository.findMonthly({ ...parsed.data, periodStart, periodEnd });
    const items: MonthlyRequisitionTimelineItem[] = [];
    const undatedItems: MonthlyRequisitionTimelineItem[] = [];
    for (const row of rows) {
      const item = normalize(row, periodStart);
      if (isUndated(row)) undatedItems.push(item);
      else items.push(item);
    }
    const all = [...items, ...undatedItems];
    return {
      companyId: parsed.data.companyId,
      period: parsed.data.period,
      items,
      undatedItems,
      indicators: {
        totalRequisitions: all.length,
        estimatedHours: all.reduce((sum, item) => sum + item.estimatedHours, 0),
        deliveredOnTime: all.filter((item) => item.deliveredOnTime).length,
        overdue: all.filter((item) => item.isOverdue).length,
      },
    };
  }
}

function isUndated(row: { startDate: string | null; plannedDeliveryDate: string | null }): boolean {
  return (
    (row.startDate === null && row.plannedDeliveryDate === null) ||
    (row.startDate !== null &&
      row.plannedDeliveryDate !== null &&
      row.startDate > row.plannedDeliveryDate)
  );
}

function normalize(
  row: MonthlyRequisitionTimelineRow,
  periodStart: string,
): MonthlyRequisitionTimelineItem {
  return {
    requisitionId: row.requisitionId,
    number: row.number,
    title: row.title,
    priority: row.priority,
    assigneeId: row.assigneeId,
    startDate: row.startDate,
    plannedDeliveryDate: row.plannedDeliveryDate,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    estimatedHours: row.estimatedHours ?? 0,
    isOverdue:
      row.plannedDeliveryDate !== null &&
      row.plannedDeliveryDate < periodStart &&
      row.deliveredAt === null,
    deliveredOnTime:
      row.deliveredAt !== null &&
      row.plannedDeliveryDate !== null &&
      row.deliveredAt.toISOString().slice(0, 10) <= row.plannedDeliveryDate,
  };
}
