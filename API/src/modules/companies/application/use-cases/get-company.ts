import {
  type CompanyOutput,
  toCompanyOutput,
} from "@/modules/companies/application/dto/company-dtos";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface GetCompanyInput {
  actor: AuthenticatedUser;
  companyId: string;
}

export class GetCompany implements UseCase<GetCompanyInput, CompanyOutput> {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetCompanyInput): Promise<CompanyOutput> {
    this.authorization.assertCompanyContext(input.actor, input.companyId);
    this.authorization.assertPermission(input.actor, "company.read");
    await this.accessService.assertAccess(input.actor.userId, input.companyId);

    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw new NotFoundError("Empresa não encontrada");
    }

    return toCompanyOutput(company);
  }
}
