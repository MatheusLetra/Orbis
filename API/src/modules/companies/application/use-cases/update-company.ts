import type { UseCase } from "../../../../shared/application/use-case.js";
import { NotFoundError, ValidationError } from "../../../../shared/errors/typed-errors.js";
import type { MembershipAccessService } from "../../../memberships/application/services/membership-access-service.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import {
  type CompanyOutput,
  toCompanyOutput,
  type UpdateCompanyInput,
  updateCompanySchema,
} from "../dto/company-dtos.js";

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
