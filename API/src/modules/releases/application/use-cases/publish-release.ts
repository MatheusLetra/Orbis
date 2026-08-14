import {
  type AuditRecorder,
  NOOP_AUDIT_RECORDER,
} from "@/modules/audit/application/ports/audit-recorder";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import {
  NOOP_NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from "@/modules/notifications/application/ports/notification-dispatcher";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type PublishReleaseInput,
  publishReleaseSchema,
  type ReleaseOutput,
  toReleaseOutput,
} from "@/modules/releases/application/dto/release-dtos";
import type { ReleaseRepository } from "@/modules/releases/domain/repositories/release-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface PublishReleaseCommand {
  actor: AuthenticatedUser;
  releaseId: string;
  data: PublishReleaseInput;
}

export class PublishRelease implements UseCase<PublishReleaseCommand, ReleaseOutput> {
  constructor(
    private readonly releaseRepository: ReleaseRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly notifications: NotificationDispatcher = NOOP_NOTIFICATION_DISPATCHER,
    private readonly audit: AuditRecorder = NOOP_AUDIT_RECORDER,
  ) {}

  async execute(input: PublishReleaseCommand): Promise<ReleaseOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "releases.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = publishReleaseSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de publicação inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const release = await this.releaseRepository.findById(input.releaseId);
    if (!release || release.companyId !== input.actor.companyId) {
      throw new NotFoundError("Release não encontrada");
    }

    if (release.status !== "DRAFT") {
      throw new ConflictError("Apenas releases em rascunho podem ser publicadas");
    }

    const updated = await this.releaseRepository.publishIfDraft(input.releaseId, {
      artifactName: parsed.data.artifactName,
      artifactLocation: parsed.data.artifactLocation,
    });
    if (!updated) {
      throw new ConflictError("Apenas releases em rascunho podem ser publicadas");
    }

    await this.notifications
      .handle({
        eventType: "RELEASE_PUBLISHED",
        companyId: updated.companyId,
        actorId: input.actor.userId,
        title: "Release publicada",
        body: updated.versionLabel,
        data: { releaseId: updated.id },
      })
      .catch(() => undefined);

    await this.audit.record({
      companyId: updated.companyId,
      actorUserId: input.actor.userId,
      action: "RELEASE_PUBLISHED",
      entityType: "RELEASE",
      entityId: updated.id,
      metadata: { versionLabel: updated.versionLabel },
    });

    return toReleaseOutput(updated);
  }
}
