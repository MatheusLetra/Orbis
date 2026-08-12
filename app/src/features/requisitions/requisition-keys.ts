import type { RequisitionListFilters } from "./requisition-contracts";

export function normalizeRequisitionFilters(filters: RequisitionListFilters = {}) {
  return {
    status: filters.status,
    priority: filters.priority,
    responsibleId: filters.responsibleId,
    search: filters.search?.trim() || undefined,
  };
}

export const requisitionKeys = {
  all: ["requisitions"] as const,
  list: (companyId: string, filters: RequisitionListFilters = {}) =>
    [...requisitionKeys.all, "list", companyId, normalizeRequisitionFilters(filters)] as const,
};
