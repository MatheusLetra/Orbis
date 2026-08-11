import {
  type CompanyOutput,
  toCompanyOutput,
} from "@/modules/companies/application/dto/company-dtos";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { UseCase } from "@/shared/application/use-case";

export interface ListCompaniesInput {
  userId: string;
}

export class ListCompanies implements UseCase<ListCompaniesInput, CompanyOutput[]> {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async execute(input: ListCompaniesInput): Promise<CompanyOutput[]> {
    const companies = await this.companyRepository.findByUser(input.userId);

    return companies.map(toCompanyOutput);
  }
}
