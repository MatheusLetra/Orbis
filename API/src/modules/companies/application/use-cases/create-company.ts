import type { UseCase } from "../../../../shared/application/use-case.js";
import { ValidationError } from "../../../../shared/errors/typed-errors.js";
import { Company } from "../../domain/entities/company.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import {
  type CompanyOutput,
  type CreateCompanyInput,
  createCompanySchema,
  toCompanyOutput,
} from "../dto/company-dtos.js";

export class CreateCompany implements UseCase<CreateCompanyInput, CompanyOutput> {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async execute(input: CreateCompanyInput): Promise<CompanyOutput> {
    const parsed = createCompanySchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados de empresa inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const company = Company.create(parsed.data);
    const created = await this.companyRepository.create(company);

    return toCompanyOutput(created);
  }
}
