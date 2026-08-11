import {
  type CompanyOutput,
  toCompanyOutput,
  type UpdateCompanyInput,
  updateCompanySchema,
} from "@/modules/companies/application/dto/company-dtos";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface UpdateCompanyCommand {
  userId: string;
  companyId: string;
  changes: UpdateCompanyInput;
}

export class UpdateCompany implements UseCase<UpdateCompanyCommand, CompanyOutput> {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
  ) {}

  async execute(input: UpdateCompanyCommand): Promise<CompanyOutput> {
    await this.accessService.assertAccess(input.userId, input.companyId);

    const parsed = updateCompanySchema.safeParse(input.changes);
    if (!parsed.success) {
      throw new ValidationError("Dados de empresa inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw new NotFoundError("Empresa não encontrada");
    }

    if (parsed.data.name !== undefined) {
      company.rename(parsed.data.name);
    }
    if (parsed.data.timezone !== undefined) {
      company.changeTimezone(parsed.data.timezone);
    }
    if (parsed.data.settings !== undefined) {
      company.changeSettings(parsed.data.settings);
    }

    const updated = await this.companyRepository.update(company);

    return toCompanyOutput(updated);
  }
}
