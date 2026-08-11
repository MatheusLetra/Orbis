import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type SystemVersionOutput,
  toSystemVersionOutput,
} from "@/modules/versions/application/dto/system-version-dtos";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface GetSystemVersionCommand {
  actor: AuthenticatedUser;
  versionId: string;
}

export class GetSystemVersion implements UseCase<GetSystemVersionCommand, SystemVersionOutput> {
  constructor(
    private readonly systemVersionRepository: SystemVersionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetSystemVersionCommand): Promise<SystemVersionOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "systems.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const version = await this.systemVersionRepository.findById(input.versionId);
    if (!version || version.companyId !== input.actor.companyId) {
      throw new NotFoundError("Versão não encontrada");
    }

    return toSystemVersionOutput(version);
  }
}
