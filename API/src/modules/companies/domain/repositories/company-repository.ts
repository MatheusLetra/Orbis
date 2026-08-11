import type { Company } from "@/modules/companies/domain/entities/company";

export interface CompanyRepository {
  create(company: Company): Promise<Company>;
  findById(id: string): Promise<Company | null>;
  findByUser(userId: string): Promise<Company[]>;
  update(company: Company): Promise<Company>;
}
