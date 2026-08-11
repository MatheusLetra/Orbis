import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface DeleteSystemVersionCommand {
  actor: AuthenticatedUser;
  versionId: string;
}

export class DeleteSystemVersion implements UseCase<DeleteSystemVersionCommand, { id: string }> {
  constructor(
    private readonly systemVersionRepository: SystemVersionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: DeleteSystemVersionCommand): Promise<{ id: string }> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "versions.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const version = await this.systemVersionRepository.findById(input.versionId);
    if (!version || version.companyId !== input.actor.companyId) {
      throw new NotFoundError("Versão não encontrada");
    }

    await this.systemVersionRepository.delete(input.versionId);

    return { id: input.versionId };
  }
}
