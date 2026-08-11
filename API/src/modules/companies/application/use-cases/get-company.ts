import {
  type CompanyOutput,
  toCompanyOutput,
} from "@/modules/companies/application/dto/company-dtos";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

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
