import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { type SystemOutput, toSystemOutput } from "@/modules/systems/application/dto/system-dtos";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface GetSystemCommand {
  actor: AuthenticatedUser;
  systemId: string;
}

export class GetSystem implements UseCase<GetSystemCommand, SystemOutput> {
  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetSystemCommand): Promise<SystemOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "systems.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const system = await this.systemRepository.findById(input.systemId);
    if (!system || system.companyId !== input.actor.companyId) {
      throw new NotFoundError("Sistema não encontrado");
    }

    return toSystemOutput(system);
  }
}
