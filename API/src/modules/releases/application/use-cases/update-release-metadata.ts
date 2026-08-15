import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  toReleaseOutput,
  type UpdateReleaseMetadataInput,
  updateReleaseMetadataSchema,
} from "@/modules/releases/application/dto/release-dtos";
import type { ReleaseRepository } from "@/modules/releases/domain/repositories/release-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export class UpdateReleaseMetadata {
  constructor(
    private readonly repository: ReleaseRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: {
    actor: AuthenticatedUser;
    releaseId: string;
    data: UpdateReleaseMetadataInput;
  }) {
    const parsed = updateReleaseMetadataSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Metadados da release inválidos", {
        details: { issues: parsed.error.issues },
      });
    }
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "releases.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const release = await this.repository.findById(input.releaseId);
    if (!release || release.companyId !== input.actor.companyId) {
      throw new NotFoundError("Release não encontrada");
    }
    if (release.status !== "DRAFT") {
      throw new ConflictError("Apenas releases em rascunho podem ser alteradas");
    }
    const updated = await this.repository.updateMetadataIfDraft(
      input.releaseId,
      input.actor.companyId,
      parsed.data,
    );
    if (!updated) {
      throw new ConflictError("Apenas releases em rascunho podem ser alteradas");
    }
    return toReleaseOutput(updated);
  }
}
