export const adminKeys = {
  tenant: (companyId: string) => ["admin", "tenant", companyId] as const,
  companies: (companyId: string) => [...adminKeys.tenant(companyId), "companies"] as const,
  capacity: (companyId: string) => [...adminKeys.tenant(companyId), "capacity-settings"] as const,
  members: (companyId: string) => [...adminKeys.tenant(companyId), "members"] as const,
  requisitions: (companyId: string, filters = "") =>
    [...adminKeys.tenant(companyId), "requisitions", filters] as const,
  requisition: (companyId: string, id: string) =>
    [...adminKeys.tenant(companyId), "requisition", id] as const,
  systems: (companyId: string) => [...adminKeys.tenant(companyId), "systems"] as const,
  versions: (companyId: string, systemId: string) =>
    [...adminKeys.tenant(companyId), "versions", systemId] as const,
  releases: (companyId: string) => [...adminKeys.tenant(companyId), "releases"] as const,
  audit: (companyId: string, filters: string) =>
    [...adminKeys.tenant(companyId), "audit", filters] as const,
};
