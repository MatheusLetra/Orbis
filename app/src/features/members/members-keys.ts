import type { MemberListFilters } from "./members-contracts";

export function normalizeMemberFilters(filters: MemberListFilters = {}): { search?: string } {
  const search = filters.search?.trim() || undefined;
  return search ? { search } : {};
}

export const memberKeys = {
  all: ["members"] as const,
  list: (companyId: string, filters: MemberListFilters = {}) =>
    [...memberKeys.all, "list", companyId, normalizeMemberFilters(filters)] as const,
};
