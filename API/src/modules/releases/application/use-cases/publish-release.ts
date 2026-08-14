import { createHash } from "node:crypto";
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
import type { ArtifactStorage } from "@/modules/releases/application/ports/artifact-storage";
import type { ReleaseRepository } from "@/modules/releases/domain/repositories/release-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface PublishReleaseCommand {
  actor: AuthenticatedUser;
  releaseId: string;
  data: PublishReleaseInput;
}

export class PublishRelease implements UseCase<PublishReleaseCommand, ReleaseOutput> {
  constructor(
    private readonly releaseRepository: ReleaseRepository,
    private readonly storage: ArtifactStorage,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly notifications: NotificationDispatcher = NOOP_NOTIFICATION_DISPATCHER,
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
      throw new BusinessRuleError("Apenas releases em rascunho podem ser publicadas");
    }

    const content = Buffer.from(parsed.data.contentBase64, "base64");
    const checksum = createHash("sha256").update(content).digest("hex");
    const storageKey = `${input.actor.companyId}/${input.releaseId}/${parsed.data.artifactName}`;

    await this.storage.save(storageKey, content);

    release.publish({
      artifactName: parsed.data.artifactName,
      storageKey,
      checksum,
      sizeBytes: content.byteLength,
    });
    const updated = await this.releaseRepository.update(release);

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

    return toReleaseOutput(updated);
  }
}
