import type {
  Requisition,
  RequisitionPriority,
  RequisitionStatus,
} from "@/modules/requisitions/domain/entities/requisition";

export interface ListRequisitionsFilters {
  status?: RequisitionStatus;
  priority?: RequisitionPriority;
  responsibleId?: string;
}

export interface RequisitionRepository {
  create(requisition: Requisition): Promise<Requisition>;
  findById(id: string): Promise<Requisition | null>;
  update(requisition: Requisition): Promise<Requisition>;
  delete(id: string): Promise<void>;
  listByCompany(companyId: string, filters?: ListRequisitionsFilters): Promise<Requisition[]>;
}
