import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type ReleaseOutput,
  toReleaseOutput,
} from "@/modules/releases/application/dto/release-dtos";
import type { ReleaseRepository } from "@/modules/releases/domain/repositories/release-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";

export interface ListReleasesCommand {
  actor: AuthenticatedUser;
}

export class ListReleases implements UseCase<ListReleasesCommand, ReleaseOutput[]> {
  constructor(
    private readonly releaseRepository: ReleaseRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListReleasesCommand): Promise<ReleaseOutput[]> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "systems.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const releases = await this.releaseRepository.listByCompany(input.actor.companyId);

    return releases.map(toReleaseOutput);
  }
}
