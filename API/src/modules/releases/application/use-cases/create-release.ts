import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type CreateReleaseInput,
  createReleaseSchema,
  type ReleaseOutput,
  toReleaseOutput,
} from "@/modules/releases/application/dto/release-dtos";
import { Release } from "@/modules/releases/domain/entities/release";
import type { ReleaseRepository } from "@/modules/releases/domain/repositories/release-repository";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface CreateReleaseCommand {
  actor: AuthenticatedUser;
  data: CreateReleaseInput;
}

export class CreateRelease implements UseCase<CreateReleaseCommand, ReleaseOutput> {
  constructor(
    private readonly releaseRepository: ReleaseRepository,
    private readonly systemVersionRepository: SystemVersionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: CreateReleaseCommand): Promise<ReleaseOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "releases.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = createReleaseSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de release inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const version = await this.systemVersionRepository.findById(parsed.data.systemVersionId);
    if (!version || version.companyId !== input.actor.companyId) {
      throw new NotFoundError("Versão não encontrada");
    }

    const release = Release.create({
      companyId: input.actor.companyId,
      systemVersionId: parsed.data.systemVersionId,
      versionLabel: parsed.data.versionLabel,
      channel: parsed.data.channel,
      createdBy: input.actor.userId,
    });
    const created = await this.releaseRepository.create(release);

    return toReleaseOutput(created);
  }
}
