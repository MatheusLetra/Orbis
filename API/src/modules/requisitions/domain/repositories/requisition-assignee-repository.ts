import type { RequisitionAssignee } from "@/modules/requisitions/domain/entities/requisition-assignee";

export interface RequisitionAssigneeRepository {
  findByRequisitionAndUser(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee | null>;
  create(companyId: string, requisitionId: string, userId: string): Promise<RequisitionAssignee>;
  delete(companyId: string, requisitionId: string, userId: string): Promise<void>;
  listByRequisition(companyId: string, requisitionId: string): Promise<RequisitionAssignee[]>;
}
