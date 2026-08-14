import type {
  RequisitionPriority,
  RequisitionStatus,
} from "@/modules/requisitions/domain/entities/requisition";

export interface YearlyRequisitionTimelineQuery {
  companyId: string;
  yearStart: string;
  yearEnd: string;
  priority?: RequisitionPriority;
  assigneeId?: string;
  status?: RequisitionStatus;
}

export interface YearlyRequisitionTimelineRow {
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

export interface YearlyRequisitionTimelineReadRepository {
  findYearly(query: YearlyRequisitionTimelineQuery): Promise<YearlyRequisitionTimelineRow[]>;
}
