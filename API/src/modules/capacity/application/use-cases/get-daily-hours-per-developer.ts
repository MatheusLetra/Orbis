import { z } from "zod";

import type { CompanyCapacitySettingsRepository } from "@/modules/capacity/application/ports/company-capacity-settings-repository";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

const inputSchema = z.object({ companyId: z.string().uuid("companyId inválido") }).strict();

export interface GetDailyHoursPerDeveloperCommand {
  actor: AuthenticatedUser;
  companyId: string;
}

export interface DailyHoursPerDeveloperOutput {
  companyId: string;
  dailyHoursPerDeveloper: number | null;
}

export class GetDailyHoursPerDeveloper
  implements UseCase<GetDailyHoursPerDeveloperCommand, DailyHoursPerDeveloperOutput>
{
  constructor(
    private readonly repository: CompanyCapacitySettingsRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetDailyHoursPerDeveloperCommand): Promise<DailyHoursPerDeveloperOutput> {
    const parsed = inputSchema.safeParse({ companyId: input.companyId });
    if (!parsed.success) {
      throw new ValidationError("Empresa inválida", { details: { issues: parsed.error.issues } });
    }

    this.authorization.assertCompanyContext(input.actor, parsed.data.companyId);
    this.authorization.assertPermission(input.actor, "capacity.read");
    await this.accessService.assertAccess(input.actor.userId, parsed.data.companyId);
    await assertActiveCompany(this.companyRepository, parsed.data.companyId);

    return {
      companyId: parsed.data.companyId,
      dailyHoursPerDeveloper: await this.repository.getDailyHoursPerDeveloper(
        parsed.data.companyId,
      ),
    };
  }
}

export async function assertActiveCompany(
  repository: CompanyRepository,
  companyId: string,
): Promise<void> {
  const company = await repository.findById(companyId);
  if (!company?.isActive) throw new NotFoundError("Empresa não encontrada");
}
