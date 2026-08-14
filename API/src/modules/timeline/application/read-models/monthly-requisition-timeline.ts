import type { RequisitionPriority } from "@/modules/requisitions/domain/entities/requisition";

export interface MonthlyRequisitionTimelineItem {
  requisitionId: string;
  number: number;
  title: string;
  priority: RequisitionPriority;
  assigneeId: string | null;
  startDate: string | null;
  plannedDeliveryDate: string | null;
  deliveredAt: string | null;
  estimatedHours: number;
  isOverdue: boolean;
  deliveredOnTime: boolean;
}

export interface MonthlyRequisitionTimelineReadModel {
  companyId: string;
  period: string;
  items: MonthlyRequisitionTimelineItem[];
  undatedItems: MonthlyRequisitionTimelineItem[];
  indicators: {
    totalRequisitions: number;
    estimatedHours: number;
    deliveredOnTime: number;
    overdue: number;
  };
}
