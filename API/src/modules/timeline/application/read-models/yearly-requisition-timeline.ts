import type { RequisitionPriority } from "@/modules/requisitions/domain/entities/requisition";

export interface YearlyRequisitionTimelineItem {
  requisitionId: string;
  number: number;
  title: string;
  priority: RequisitionPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  startDate: string | null;
  plannedDeliveryDate: string | null;
  deliveredAt: string | null;
  estimatedHours: number;
  isOverdue: boolean;
  deliveredOnTime: boolean;
}

export interface YearlyRequisitionTimelineMonth {
  period: string;
  requisitionCount: number;
  countsByPriority: Record<RequisitionPriority, number>;
  estimatedHours: number;
  deliveredOnTime: number;
  overdue: number;
  items: YearlyRequisitionTimelineItem[];
  undatedItems: YearlyRequisitionTimelineItem[];
}

export interface YearlyRequisitionTimelineReadModel {
  companyId: string;
  year: string;
  months: YearlyRequisitionTimelineMonth[];
  indicators: {
    totalRequisitions: number;
    estimatedHours: number;
    deliveredOnTime: number;
    overdue: number;
  };
}
