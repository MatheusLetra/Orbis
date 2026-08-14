export const notificationKeys = {
  all: ["notifications"] as const,
  company: (companyId: string) => [...notificationKeys.all, companyId] as const,
  list: (companyId: string, limit = 20) =>
    [...notificationKeys.company(companyId), "list", { limit }] as const,
  preferences: (companyId: string) =>
    [...notificationKeys.company(companyId), "preferences"] as const,
};
