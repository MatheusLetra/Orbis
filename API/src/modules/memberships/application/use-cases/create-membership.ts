import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import {
  type CreateMembershipInput,
  createMembershipSchema,
  type MembershipOutput,
  toMembershipOutput,
} from "@/modules/memberships/application/dto/membership-dtos";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";
import type { UseCase } from "@/shared/application/use-case";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export class CreateMembership implements UseCase<CreateMembershipInput, MembershipOutput> {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: CreateMembershipInput): Promise<MembershipOutput> {
    const parsed = createMembershipSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados de membership inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

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
