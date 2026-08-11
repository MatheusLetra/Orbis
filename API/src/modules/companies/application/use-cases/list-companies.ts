import type { UseCase } from "../../../../shared/application/use-case.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import { type CompanyOutput, toCompanyOutput } from "../dto/company-dtos.js";

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
