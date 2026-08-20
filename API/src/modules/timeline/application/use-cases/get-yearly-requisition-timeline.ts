import { z } from "zod";

import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  REQUISITION_PRIORITIES,
  REQUISITION_STATUSES,
} from "@/modules/requisitions/domain/entities/requisition";
import type {
  YearlyRequisitionTimelineReadRepository,
  YearlyRequisitionTimelineRow,
} from "@/modules/timeline/application/ports/yearly-requisition-timeline-read-repository";
import type {
  YearlyRequisitionTimelineItem,
  YearlyRequisitionTimelineMonth,
  YearlyRequisitionTimelineReadModel,
} from "@/modules/timeline/application/read-models/yearly-requisition-timeline";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

const yearPattern = /^\d{4}$/;
const inputSchema = z
  .object({
    companyId: z.string().uuid(),
    year: z.string().regex(yearPattern),
    priority: z.enum(REQUISITION_PRIORITIES).optional(),
    assigneeId: z.string().uuid().optional(),
    status: z.enum(REQUISITION_STATUSES).optional(),
  })
  .strict();

export interface GetYearlyRequisitionTimelineCommand {
  actor: AuthenticatedUser;
  companyId: string;
  year: string;
  filters?: {
    priority?: (typeof REQUISITION_PRIORITIES)[number];
    assigneeId?: string;
    status?: (typeof REQUISITION_STATUSES)[number];
  };
}

export class GetYearlyRequisitionTimeline
  implements UseCase<GetYearlyRequisitionTimelineCommand, YearlyRequisitionTimelineReadModel>
{
  constructor(
    private readonly repository: YearlyRequisitionTimelineReadRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(
    input: GetYearlyRequisitionTimelineCommand,
  ): Promise<YearlyRequisitionTimelineReadModel> {
    const parsed = inputSchema.safeParse({
      companyId: input.companyId,
      year: input.year,
      ...input.filters,
    });
    if (!parsed.success) {
      throw new ValidationError("Filtros da timeline anual inválidos", {
        details: { issues: parsed.error.issues },
      });
    }
    this.authorization.assertCompanyContext(input.actor, parsed.data.companyId);
    this.authorization.assertPermission(input.actor, "requisitions.read");
    await this.accessService.assertAccess(input.actor.userId, parsed.data.companyId);
    const company = await this.companyRepository.findById(parsed.data.companyId);
    if (!company?.isActive) throw new NotFoundError("Empresa não encontrada");

    const yearStart = `${parsed.data.year}-01-01`;
    const yearEnd = `${parsed.data.year}-12-31`;
    const rows = await this.repository.findYearly({ ...parsed.data, yearStart, yearEnd });
    const undated = rows.filter(isUndated).map((row) => normalize(row, yearStart));
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = `${parsed.data.year}-${String(index + 1).padStart(2, "0")}`;
      const periodStart = `${month}-01`;
      const periodEnd = lastDay(month);
      const items = rows
        .filter((row) => !isUndated(row) && intersects(row, periodStart, periodEnd))
        .map((row) => normalize(row, periodStart))
        .sort(compareItems);
      const monthItems = [...items, ...undated].sort(compareItems);
      return buildMonth(month, monthItems);
    });
    const all = rows.map((row) => normalize(row, yearStart));
    return {
      companyId: parsed.data.companyId,
      year: parsed.data.year,
      months,
      indicators: indicators(all),
    };
  }
}

function isUndated(row: Pick<YearlyRequisitionTimelineRow, "startDate" | "plannedDeliveryDate">) {
  return (
    (row.startDate === null && row.plannedDeliveryDate === null) ||
    (row.startDate !== null &&
      row.plannedDeliveryDate !== null &&
      row.startDate > row.plannedDeliveryDate)
  );
}

function intersects(row: YearlyRequisitionTimelineRow, start: string, end: string) {
  const effectiveStart = row.startDate ?? row.plannedDeliveryDate;
  const effectiveEnd = row.plannedDeliveryDate ?? row.startDate;
  return (
    effectiveStart !== null &&
    effectiveEnd !== null &&
    effectiveStart <= end &&
    effectiveEnd >= start
  );
}

function normalize(
  row: YearlyRequisitionTimelineRow,
  periodStart: string,
): YearlyRequisitionTimelineItem {
  return {
    requisitionId: row.requisitionId,
    number: row.number,
    title: row.title,
    priority: row.priority,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName,
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

function compareItems(left: YearlyRequisitionTimelineItem, right: YearlyRequisitionTimelineItem) {
  return (
    (left.plannedDeliveryDate ?? "9999-12-31").localeCompare(
      right.plannedDeliveryDate ?? "9999-12-31",
    ) ||
    priorityRank(left.priority) - priorityRank(right.priority) ||
    left.title.localeCompare(right.title) ||
    left.number - right.number
  );
}

function priorityRank(priority: YearlyRequisitionTimelineItem["priority"]) {
  return { HIGH: 0, MEDIUM: 1, LOW: 2 }[priority];
}

function buildMonth(
  period: string,
  items: YearlyRequisitionTimelineItem[],
): YearlyRequisitionTimelineMonth {
  return {
    period,
    requisitionCount: new Set(items.map((item) => item.requisitionId)).size,
    countsByPriority: {
      LOW: items.filter((item) => item.priority === "LOW").length,
      MEDIUM: items.filter((item) => item.priority === "MEDIUM").length,
      HIGH: items.filter((item) => item.priority === "HIGH").length,
    },
    estimatedHours: items.reduce((sum, item) => sum + item.estimatedHours, 0),
    deliveredOnTime: items.filter((item) => item.deliveredOnTime).length,
    overdue: items.filter((item) => item.isOverdue).length,
    items: items.filter((item) => !isUndated(item)),
    undatedItems: items.filter(isUndated),
  };
}

function indicators(items: YearlyRequisitionTimelineItem[]) {
  return {
    totalRequisitions: items.length,
    estimatedHours: items.reduce((sum, item) => sum + item.estimatedHours, 0),
    deliveredOnTime: items.filter((item) => item.deliveredOnTime).length,
    overdue: items.filter((item) => item.isOverdue).length,
  };
}

function lastDay(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, month ?? 1, 0)).toISOString().slice(0, 10);
}
