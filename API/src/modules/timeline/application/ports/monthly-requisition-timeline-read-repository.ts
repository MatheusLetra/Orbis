import type {
  RequisitionPriority,
  RequisitionStatus,
} from "@/modules/requisitions/domain/entities/requisition";

export interface MonthlyRequisitionTimelineQuery {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  priority?: RequisitionPriority;
  assigneeId?: string;
  status?: RequisitionStatus;
}

export interface MonthlyRequisitionTimelineRow {
  requisitionId: string;
  number: number;
  title: string;
  priority: RequisitionPriority;
  assigneeId: string | null;
  startDate: string | null;
  plannedDeliveryDate: string | null;
  deliveredAt: Date | null;
  estimatedHours: number | null;
}

export interface MonthlyRequisitionTimelineReadRepository {
  findMonthly(query: MonthlyRequisitionTimelineQuery): Promise<MonthlyRequisitionTimelineRow[]>;
}
