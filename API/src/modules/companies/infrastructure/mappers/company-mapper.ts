import { Company } from "@/modules/companies/domain/entities/company";

export type CompanyRow = {
  id: string;
  name: string;
  timezone: string;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toEntity(row: CompanyRow): Company {
  return Company.restore(row);
}

export function toInsertValues(company: Company): CompanyRow {
  return {
    id: company.id,
    name: company.name,
    timezone: company.timezone,
    settings: company.settings,
    isActive: company.isActive,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}
