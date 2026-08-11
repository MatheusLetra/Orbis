import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import {
  type CreateMembershipInput,
  createMembershipSchema,
  type MembershipOutput,
  toMembershipOutput,
} from "@/modules/memberships/application/dto/membership-dtos";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface CreateMembershipCommand {
  actor: AuthenticatedUser;
  data: CreateMembershipInput;
}

export class CreateMembership implements UseCase<CreateMembershipCommand, MembershipOutput> {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly userRepository: UserRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: CreateMembershipCommand): Promise<MembershipOutput> {
    const parsed = createMembershipSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de membership inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    this.authorization.assertCompanyContext(input.actor, parsed.data.companyId);
    this.authorization.assertPermission(input.actor, "users.manage");
    await this.accessService.assertAccess(input.actor.userId, parsed.data.companyId);

    const company = await this.companyRepository.findById(parsed.data.companyId);
    if (!company) {
      throw new NotFoundError("Empresa não encontrada");
    }

    const user = await this.userRepository.findById(parsed.data.userId);
    if (!user) {
      throw new NotFoundError("Usuário não encontrado");
    }

    const existing = await this.membershipRepository.findByUserAndCompany(
      parsed.data.userId,
      parsed.data.companyId,
    );
    if (existing) {
      throw new ConflictError("Usuário já possui membership nesta empresa");
    }

    const membership = Membership.create(parsed.data);
    const created = await this.membershipRepository.create(membership);

    return toMembershipOutput(created);
  }
}
