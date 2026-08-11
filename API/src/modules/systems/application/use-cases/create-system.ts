import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type CreateSystemInput,
  createSystemSchema,
  type SystemOutput,
  toSystemOutput,
} from "@/modules/systems/application/dto/system-dtos";
import { System } from "@/modules/systems/domain/entities/system";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ConflictError, ValidationError } from "@/shared/errors/typed-errors";

export interface CreateSystemCommand {
  actor: AuthenticatedUser;
  data: CreateSystemInput;
}

export class CreateSystem implements UseCase<CreateSystemCommand, SystemOutput> {
  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: CreateSystemCommand): Promise<SystemOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "systems.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = createSystemSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de sistema inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const existing = await this.systemRepository.findByNameInCompany(
      input.actor.companyId,
      parsed.data.name,
    );
    if (existing) {
      throw new ConflictError("Já existe um sistema com este nome nesta empresa");
    }

    const system = System.create({
      companyId: input.actor.companyId,
      name: parsed.data.name,
      description: parsed.data.description,
    });
    const created = await this.systemRepository.create(system);

    return toSystemOutput(created);
  }
}
