import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/shared/errors/typed-errors";

export class ChatAuthorizationService {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  async assertActor(actor: AuthenticatedUser): Promise<void> {
    this.authorization.assertCompanyContext(actor, actor.companyId);
    this.authorization.assertPermission(actor, "chat.use");
    const [company, membership] = await Promise.all([
      this.companies.findById(actor.companyId),
      this.memberships.findByUserAndCompany(actor.userId, actor.companyId),
    ]);
    if (!company?.isActive) throw new ForbiddenError("Empresa inativa ou inacessível");
    if (!membership?.isActive) throw new ForbiddenError("Usuário não possui acesso a esta empresa");
  }

  async assertParticipant(actor: AuthenticatedUser, participantId: string): Promise<void> {
    if (participantId === actor.userId) {
      throw new BusinessRuleError("O participante deve ser outro usuário");
    }
    const [user, membership] = await Promise.all([
      this.users.findById(participantId),
      this.memberships.findByUserAndCompany(participantId, actor.companyId),
    ]);
    if (!user || !membership) throw new NotFoundError("Participante não encontrado na empresa");
    if (!user.isActive || !membership.isActive) {
      throw new ForbiddenError("Participante inativo na empresa");
    }
  }
}
