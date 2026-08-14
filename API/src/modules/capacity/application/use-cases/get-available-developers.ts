import { z } from "zod";
import type { DeveloperAvailabilityRepository } from "@/modules/capacity/application/ports/developer-availability-repository";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

const inputSchema = z.object({ companyId: z.string().uuid("companyId inválido") }).strict();

export interface GetAvailableDevelopersCommand {
  actor: AuthenticatedUser;
  companyId: string;
}

export interface AvailableDevelopersOutput {
  companyId: string;
  availableDevelopers: number;
}

export class GetAvailableDevelopers
  implements UseCase<GetAvailableDevelopersCommand, AvailableDevelopersOutput>
{
  constructor(
    private readonly repository: DeveloperAvailabilityRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetAvailableDevelopersCommand): Promise<AvailableDevelopersOutput> {
    const parsed = inputSchema.safeParse({ companyId: input.companyId });
    if (!parsed.success) {
      throw new ValidationError("Empresa inválida", { details: { issues: parsed.error.issues } });
    }

    this.authorization.assertCompanyContext(input.actor, parsed.data.companyId);
    this.authorization.assertPermission(input.actor, "capacity.read");
    await this.accessService.assertAccess(input.actor.userId, parsed.data.companyId);

    const company = await this.companyRepository.findById(parsed.data.companyId);
    if (!company?.isActive) throw new NotFoundError("Empresa não encontrada");

    return {
      companyId: parsed.data.companyId,
      availableDevelopers: await this.repository.countAvailableDevelopers(parsed.data.companyId),
    };
  }
}
