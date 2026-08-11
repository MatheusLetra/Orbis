import type { UseCase } from "../../../../shared/application/use-case.js";
import { NotFoundError } from "../../../../shared/errors/typed-errors.js";
import type { MembershipAccessService } from "../../../memberships/application/services/membership-access-service.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import { type CompanyOutput, toCompanyOutput } from "../dto/company-dtos.js";

export interface GetCompanyInput {
  userId: string;
  companyId: string;
}

export class GetCompany implements UseCase<GetCompanyInput, CompanyOutput> {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
  ) {}

  async execute(input: GetCompanyInput): Promise<CompanyOutput> {
    await this.accessService.assertAccess(input.userId, input.companyId);

    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw new NotFoundError("Empresa não encontrada");
    }

    return toCompanyOutput(company);
  }
}
