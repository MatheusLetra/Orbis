import {
  type AuditRecorder,
  NOOP_AUDIT_RECORDER,
} from "@/modules/audit/application/ports/audit-recorder";
import {
  type CompanyOutput,
  toCompanyOutput,
  type UpdateCompanyInput,
  updateCompanySchema,
} from "@/modules/companies/application/dto/company-dtos";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface UpdateCompanyCommand {
  actor: AuthenticatedUser;
  companyId: string;
  changes: UpdateCompanyInput;
}

export class UpdateCompany implements UseCase<UpdateCompanyCommand, CompanyOutput> {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditRecorder = NOOP_AUDIT_RECORDER,
  ) {}

  async execute(input: UpdateCompanyCommand): Promise<CompanyOutput> {
    this.authorization.assertCompanyContext(input.actor, input.companyId);
    this.authorization.assertPermission(input.actor, "company.update");
    await this.accessService.assertAccess(input.actor.userId, input.companyId);

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

    await this.audit.record({
      companyId: updated.id,
      actorUserId: input.actor.userId,
      action: "COMPANY_UPDATED",
      entityType: "COMPANY",
      entityId: updated.id,
      metadata: { changedFields: Object.keys(parsed.data) },
    });

    return toCompanyOutput(updated);
  }
}
