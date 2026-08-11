import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type SystemOutput,
  toSystemOutput,
  type UpdateSystemInput,
  updateSystemSchema,
} from "@/modules/systems/application/dto/system-dtos";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface UpdateSystemCommand {
  actor: AuthenticatedUser;
  systemId: string;
  changes: UpdateSystemInput;
}

export class UpdateSystem implements UseCase<UpdateSystemCommand, SystemOutput> {
  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: UpdateSystemCommand): Promise<SystemOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "systems.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = updateSystemSchema.safeParse(input.changes);
    if (!parsed.success) {
      throw new ValidationError("Dados de sistema inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const system = await this.systemRepository.findById(input.systemId);
    if (!system || system.companyId !== input.actor.companyId) {
      throw new NotFoundError("Sistema não encontrado");
    }

    if (parsed.data.name !== undefined && parsed.data.name !== system.name) {
      const existing = await this.systemRepository.findByNameInCompany(
        input.actor.companyId,
        parsed.data.name,
      );
      if (existing && existing.id !== system.id) {
        throw new ConflictError("Já existe um sistema com este nome nesta empresa");
      }
      system.rename(parsed.data.name);
    }
    if (parsed.data.description !== undefined) {
      system.changeDescription(parsed.data.description);
    }

    const updated = await this.systemRepository.update(system);

    return toSystemOutput(updated);
  }
}
