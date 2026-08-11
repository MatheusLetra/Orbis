import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import {
  type CreateSystemVersionInput,
  createSystemVersionSchema,
  type SystemVersionOutput,
  toSystemVersionOutput,
} from "@/modules/versions/application/dto/system-version-dtos";
import { SystemVersion } from "@/modules/versions/domain/entities/system-version";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface CreateSystemVersionCommand {
  actor: AuthenticatedUser;
  systemId: string;
  data: CreateSystemVersionInput;
}

export class CreateSystemVersion
  implements UseCase<CreateSystemVersionCommand, SystemVersionOutput>
{
  constructor(
    private readonly systemVersionRepository: SystemVersionRepository,
    private readonly systemRepository: SystemRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: CreateSystemVersionCommand): Promise<SystemVersionOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "versions.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = createSystemVersionSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de versão inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const system = await this.systemRepository.findById(input.systemId);
    if (!system || system.companyId !== input.actor.companyId) {
      throw new NotFoundError("Sistema não encontrado");
    }

    const existing = await this.systemVersionRepository.findVersionInSystem(
      input.systemId,
      parsed.data.version,
    );
    if (existing) {
      throw new ConflictError("Esta versão já existe para o sistema");
    }

    const version = SystemVersion.create({
      companyId: input.actor.companyId,
      systemId: input.systemId,
      version: parsed.data.version,
    });
    const created = await this.systemVersionRepository.create(version);

    return toSystemVersionOutput(created);
  }
}
