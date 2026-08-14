import { z } from "zod";
import {
  type AuditRecorder,
  NOOP_AUDIT_RECORDER,
} from "@/modules/audit/application/ports/audit-recorder";
import type { CompanyCapacitySettingsRepository } from "@/modules/capacity/application/ports/company-capacity-settings-repository";
import { assertDailyHoursPerDeveloper } from "@/modules/capacity/domain/value-objects/daily-hours-per-developer";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ValidationError } from "@/shared/errors/typed-errors";
import { assertActiveCompany } from "./get-daily-hours-per-developer";

const inputSchema = z
  .object({
    companyId: z.string().uuid("companyId inválido"),
    dailyHoursPerDeveloper: z.number(),
  })
  .strict();

export interface SetDailyHoursPerDeveloperCommand {
  actor: AuthenticatedUser;
  companyId: string;
  dailyHoursPerDeveloper: number;
}

export class SetDailyHoursPerDeveloper
  implements UseCase<SetDailyHoursPerDeveloperCommand, number>
{
  constructor(
    private readonly repository: CompanyCapacitySettingsRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditRecorder = NOOP_AUDIT_RECORDER,
  ) {}

  async execute(input: SetDailyHoursPerDeveloperCommand): Promise<number> {
    const parsed = inputSchema.safeParse({
      companyId: input.companyId,
      dailyHoursPerDeveloper: input.dailyHoursPerDeveloper,
    });
    if (!parsed.success) {
      throw new ValidationError("Configuração de capacidade inválida", {
        details: { issues: parsed.error.issues },
      });
    }

    this.authorization.assertCompanyContext(input.actor, parsed.data.companyId);
    this.authorization.assertPermission(input.actor, "company.update");
    await this.accessService.assertAccess(input.actor.userId, parsed.data.companyId);
    await assertActiveCompany(this.companyRepository, parsed.data.companyId);

    try {
      assertDailyHoursPerDeveloper(parsed.data.dailyHoursPerDeveloper);
    } catch (error) {
      throw new ValidationError("Configuração de capacidade inválida", { cause: error });
    }

    const updated = await this.repository.setDailyHoursPerDeveloper(
      parsed.data.companyId,
      parsed.data.dailyHoursPerDeveloper,
    );
    await this.audit.record({
      companyId: parsed.data.companyId,
      actorUserId: input.actor.userId,
      action: "CONFIGURATION_UPDATED",
      entityType: "COMPANY_CAPACITY",
      entityId: parsed.data.companyId,
      metadata: { changedFields: ["dailyHoursPerDeveloper"] },
    });
    return updated;
  }
}
