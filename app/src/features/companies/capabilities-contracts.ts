export const COMPANY_CAPABILITY_NAMES = [
  "tasks.create",
  "tasks.update",
  "kanban.manage",
  "hours.register",
  "capacity.read",
  "users.read",
  "requisitions.read",
] as const;

export type CompanyCapability = (typeof COMPANY_CAPABILITY_NAMES)[number];

export interface CompanyCapabilities {
  companyId: string;
  capabilities: Record<CompanyCapability, boolean>;
}

export function parseCompanyCapabilities(value: unknown): CompanyCapabilities {
  if (!isRecord(value) || typeof value.companyId !== "string" || !isRecord(value.capabilities)) {
    throw new Error("Contrato de capabilities inválido");
  }

  const capabilityNames = Object.keys(value.capabilities);
  if (
    capabilityNames.some((name) => !COMPANY_CAPABILITY_NAMES.includes(name as CompanyCapability))
  ) {
    throw new Error("Contrato de capabilities inválido");
  }

  const capabilities = {} as Record<CompanyCapability, boolean>;
  for (const name of COMPANY_CAPABILITY_NAMES) {
    if (typeof value.capabilities[name] !== "boolean") {
      throw new Error("Contrato de capabilities inválido");
    }
    capabilities[name] = value.capabilities[name];
  }

  return { companyId: value.companyId, capabilities };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
