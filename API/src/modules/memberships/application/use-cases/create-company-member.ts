import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import {
  type CreateCompanyMemberInput,
  createCompanyMemberSchema,
  toMembershipOutput,
} from "@/modules/memberships/application/dto/membership-dtos";
import type { MembershipUnitOfWork } from "@/modules/memberships/application/ports/membership-unit-of-work";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { PasswordHasher } from "@/modules/users/application/ports/password-hasher";
import { User } from "@/modules/users/domain/entities/user";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export class CreateCompanyMember {
  constructor(
    private readonly unitOfWork: MembershipUnitOfWork,
    private readonly passwordHasher: PasswordHasher,
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: { actor: AuthenticatedUser; data: CreateCompanyMemberInput }) {
    const parsed = createCompanyMemberSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados do membro inválidos", {
        details: { issues: parsed.error.issues },
      });
    }
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "users.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);
    const company = await this.companyRepository.findById(input.actor.companyId);
    if (!company?.isActive) throw new NotFoundError("Empresa não encontrada");

    const passwordHash = await this.passwordHasher.hash(parsed.data.password);
    return this.unitOfWork.execute(async ({ users, memberships }) => {
      if (await users.findByEmail(parsed.data.email)) {
        throw new ConflictError("Já existe um usuário com este e-mail");
      }
      const user = await users.create(
        User.create({
          email: parsed.data.email,
          name: parsed.data.name,
          passwordHash,
        }),
      );
      const membership = await memberships.create(
        Membership.create({
          companyId: input.actor.companyId,
          userId: user.id,
          position: parsed.data.position,
        }),
      );
      return {
        ...toMembershipOutput(membership),
        name: user.name,
        email: user.email,
        userIsActive: user.isActive,
      };
    });
  }
}
