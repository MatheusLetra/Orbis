import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { type SystemOutput, toSystemOutput } from "@/modules/systems/application/dto/system-dtos";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";

export interface ListSystemsCommand {
  actor: AuthenticatedUser;
}

export class ListSystems implements UseCase<ListSystemsCommand, SystemOutput[]> {
  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListSystemsCommand): Promise<SystemOutput[]> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "systems.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const systems = await this.systemRepository.listByCompany(input.actor.companyId);

    return systems.map(toSystemOutput);
  }
}
