import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type ReleaseOutput,
  toReleaseOutput,
} from "@/modules/releases/application/dto/release-dtos";
import type { ReleaseRepository } from "@/modules/releases/domain/repositories/release-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface GetReleaseCommand {
  actor: AuthenticatedUser;
  releaseId: string;
}

export class GetRelease implements UseCase<GetReleaseCommand, ReleaseOutput> {
  constructor(
    private readonly releaseRepository: ReleaseRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetReleaseCommand): Promise<ReleaseOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "releases.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const release = await this.releaseRepository.findById(input.releaseId);
    if (!release || release.companyId !== input.actor.companyId) {
      throw new NotFoundError("Release não encontrada");
    }

    return toReleaseOutput(release);
  }
}
