export const REQUISITION_STATUSES = ["OPEN", "IN_PROGRESS", "PAUSED", "DONE", "CANCELLED"] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];
export type RequisitionPriority = "LOW" | "MEDIUM" | "HIGH";

export interface Requisition {
  id: string;
  companyId: string;
  number: number;
  title: string;
  description: string | null;
  priority: RequisitionPriority;
  status: RequisitionStatus;
  requesterId: string;
  responsibleId: string | null;
  systemId: string | null;
  systemVersionId: string | null;
  estimatedHours: number | null;
  startDate: string | null;
  plannedDeliveryDate: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequisitionListFilters {
  status?: RequisitionStatus;
  priority?: RequisitionPriority;
  responsibleId?: string;
  search?: string;
}
