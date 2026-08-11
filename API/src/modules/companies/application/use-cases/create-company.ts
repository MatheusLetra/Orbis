import {
  type CompanyOutput,
  type CreateCompanyInput,
  createCompanySchema,
  toCompanyOutput,
} from "@/modules/companies/application/dto/company-dtos";
import { Company } from "@/modules/companies/domain/entities/company";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { UseCase } from "@/shared/application/use-case";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface CreateCompanyCommand {
  ownerId: string;
  company: CreateCompanyInput;
}

export class CreateCompany implements UseCase<CreateCompanyCommand, CompanyOutput> {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async execute(input: CreateCompanyCommand): Promise<CompanyOutput> {
    const parsed = createCompanySchema.safeParse(input.company);
    if (!parsed.success) {
      throw new ValidationError("Dados de empresa inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const company = Company.create(parsed.data);
    const created = await this.companyRepository.create(company);

    await this.membershipRepository.create(
      Membership.create({
        companyId: created.id,
        userId: input.ownerId,
        position: "GESTOR",
      }),
    );

    return toCompanyOutput(created);
  }
}
