import { describe, expect, it } from "vitest";

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/typed-errors.js";
import {
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
  InMemoryUserRepository,
} from "../../../../test/fakes/identity-fakes.js";
import { Company } from "../../../companies/domain/entities/company.js";
import { User } from "../../../users/domain/entities/user.js";
import { CreateMembership } from "./create-membership.js";
import { ListMemberships } from "./list-memberships.js";

async function build() {
  const companyRepository = new InMemoryCompanyRepository();
  const userRepository = new InMemoryUserRepository();
  const membershipRepository = new InMemoryMembershipRepository();

  const company = await companyRepository.create(Company.create({ name: "Orbis Corp" }));
  const user = await userRepository.create(
    User.create({ email: "dev@orbis.com", name: "Ana", passwordHash: "scrypt:abc" }),
  );

  return {
    companyRepository,
    userRepository,
    membershipRepository,
    company,
    user,
    useCase: new CreateMembership(membershipRepository, companyRepository, userRepository),
  };
}

describe("CreateMembership", () => {
  it("cria o vínculo entre usuário e empresa com cargo", async () => {
    const { useCase, company, user } = await build();

    const output = await useCase.execute({
      companyId: company.id,
      userId: user.id,
      position: "DESENVOLVEDOR",
    });

    expect(output.companyId).toBe(company.id);
    expect(output.userId).toBe(user.id);
    expect(output.position).toBe("DESENVOLVEDOR");
    expect(output.isActive).toBe(true);
  });

  it("rejeita cargo vazio", async () => {
    const { useCase, company, user } = await build();

    await expect(
      useCase.execute({ companyId: company.id, userId: user.id, position: "  " }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejeita ids que não são uuid", async () => {
    const { useCase } = await build();

    await expect(
      useCase.execute({ companyId: "nao-uuid", userId: "nao-uuid", position: "GESTOR" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lança NotFoundError quando a empresa não existe", async () => {
    const { useCase, user } = await build();

    await expect(
      useCase.execute({
        companyId: "00000000-0000-4000-8000-000000000001",
        userId: user.id,
        position: "GESTOR",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança NotFoundError quando o usuário não existe", async () => {
    const { useCase, company } = await build();

    await expect(
      useCase.execute({
        companyId: company.id,
        userId: "00000000-0000-4000-8000-000000000002",
        position: "GESTOR",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança ConflictError quando já existe membership", async () => {
    const { useCase, company, user } = await build();
    await useCase.execute({ companyId: company.id, userId: user.id, position: "GESTOR" });

    await expect(
      useCase.execute({ companyId: company.id, userId: user.id, position: "SUPORTE" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("ListMemberships", () => {
  it("lista as memberships do usuário", async () => {
    const { useCase, membershipRepository, company, user } = await build();
    await useCase.execute({ companyId: company.id, userId: user.id, position: "GESTOR" });

    const listUseCase = new ListMemberships(membershipRepository);
    const output = await listUseCase.execute({ userId: user.id });

    expect(output).toHaveLength(1);
    expect(output[0]?.companyId).toBe(company.id);
  });
});
