import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type SystemVersionOutput,
  toSystemVersionOutput,
  type UpdateSystemVersionInput,
  updateSystemVersionSchema,
} from "@/modules/versions/application/dto/system-version-dtos";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface UpdateSystemVersionCommand {
  actor: AuthenticatedUser;
  versionId: string;
  changes: UpdateSystemVersionInput;
}

export class UpdateSystemVersion
  implements UseCase<UpdateSystemVersionCommand, SystemVersionOutput>
{
  constructor(
    private readonly systemVersionRepository: SystemVersionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: UpdateSystemVersionCommand): Promise<SystemVersionOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "versions.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = updateSystemVersionSchema.safeParse(input.changes);
    if (!parsed.success) {
      throw new ValidationError("Dados de versão inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const version = await this.systemVersionRepository.findById(input.versionId);
    if (!version || version.companyId !== input.actor.companyId) {
      throw new NotFoundError("Versão não encontrada");
    }

    if (parsed.data.version !== undefined && parsed.data.version !== version.version) {
      const existing = await this.systemVersionRepository.findVersionInSystem(
        version.systemId,
        parsed.data.version,
      );
      if (existing && existing.id !== version.id) {
        throw new ConflictError("Esta versão já existe para o sistema");
      }
      version.changeVersion(parsed.data.version);
    }

    const updated = await this.systemVersionRepository.update(version);

    return toSystemVersionOutput(updated);
  }
}
