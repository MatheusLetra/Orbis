import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import {
  type SystemVersionOutput,
  toSystemVersionOutput,
} from "@/modules/versions/application/dto/system-version-dtos";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface ListSystemVersionsCommand {
  actor: AuthenticatedUser;
  systemId: string;
}

export class ListSystemVersions
  implements UseCase<ListSystemVersionsCommand, SystemVersionOutput[]>
{
  constructor(
    private readonly systemVersionRepository: SystemVersionRepository,
    private readonly systemRepository: SystemRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListSystemVersionsCommand): Promise<SystemVersionOutput[]> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "systems.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const system = await this.systemRepository.findById(input.systemId);
    if (!system || system.companyId !== input.actor.companyId) {
      throw new NotFoundError("Sistema não encontrado");
    }

    const versions = await this.systemVersionRepository.listBySystem(input.systemId);

    return versions.map(toSystemVersionOutput);
  }
}
