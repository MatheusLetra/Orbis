import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface DeleteSystemCommand {
  actor: AuthenticatedUser;
  systemId: string;
}

export class DeleteSystem implements UseCase<DeleteSystemCommand, { id: string }> {
  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: DeleteSystemCommand): Promise<{ id: string }> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "systems.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const system = await this.systemRepository.findById(input.systemId);
    if (!system || system.companyId !== input.actor.companyId) {
      throw new NotFoundError("Sistema não encontrado");
    }

    await this.systemRepository.delete(input.systemId);

    return { id: input.systemId };
  }
}
