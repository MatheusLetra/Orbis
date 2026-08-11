import type { UseCase } from "../../../../shared/application/use-case.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/typed-errors.js";
import type { CompanyRepository } from "../../../companies/domain/repositories/company-repository.js";
import type { UserRepository } from "../../../users/domain/repositories/user-repository.js";
import { Membership } from "../../domain/entities/membership.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import {
  type CreateMembershipInput,
  createMembershipSchema,
  type MembershipOutput,
  toMembershipOutput,
} from "../dto/membership-dtos.js";

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
