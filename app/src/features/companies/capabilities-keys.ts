export const capabilitiesKeys = {
  all: ["company-capabilities"] as const,
  company: (companyId: string) => [...capabilitiesKeys.all, companyId] as const,
};
