import { describe, expect, it } from "vitest";

import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/typed-errors.js";
import {
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
} from "../../../../test/fakes/identity-fakes.js";
import { MembershipAccessService } from "../../../memberships/application/services/membership-access-service.js";
import { Membership } from "../../../memberships/domain/entities/membership.js";
import { Company } from "../../domain/entities/company.js";
import { CreateCompany } from "./create-company.js";
import { GetCompany } from "./get-company.js";
import { ListCompanies } from "./list-companies.js";
import { UpdateCompany } from "./update-company.js";

function build() {
  const companyRepository = new InMemoryCompanyRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  return { companyRepository, membershipRepository, accessService };
}

function seedCompany(name: string) {
  return Company.create({ name });
}

async function linkUser(
  membershipRepository: InMemoryMembershipRepository,
  userId: string,
  companyId: string,
) {
  await membershipRepository.create(
    Membership.create({ companyId, userId, position: "ADMINISTRADOR" }),
  );
}

describe("CreateCompany", () => {
  it("cria uma empresa com timezone padrão", async () => {
    const { companyRepository } = build();
    const useCase = new CreateCompany(companyRepository);

    const output = await useCase.execute({ name: "Orbis Corp" });

    expect(output.name).toBe("Orbis Corp");
    expect(output.timezone).toBe("America/Sao_Paulo");
    expect(output.isActive).toBe(true);
    expect(output.id).toBeTypeOf("string");
  });

  it("valida entrada inválida", async () => {
    const { companyRepository } = build();
    const useCase = new CreateCompany(companyRepository);

    await expect(useCase.execute({ name: "  " })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("ListCompanies", () => {
  it("lista apenas as empresas com membership ativa do usuário", async () => {
    const { companyRepository, membershipRepository } = build();
    const companyA = await companyRepository.create(seedCompany("A"));
    const companyB = await companyRepository.create(seedCompany("B"));
    await companyRepository.create(seedCompany("C"));

    await membershipRepository.create(
      Membership.create({ companyId: companyA.id, userId: "user-1", position: "GESTOR" }),
    );
    await membershipRepository.create(
      Membership.create({ companyId: companyB.id, userId: "user-1", position: "SUPORTE" }),
    );
    companyRepository.linkUser("user-1", companyA.id);
    companyRepository.linkUser("user-1", companyB.id);

    const useCase = new ListCompanies(companyRepository);
    const companies = await useCase.execute({ userId: "user-1" });

    expect(companies.map((c) => c.name).sort()).toEqual(["A", "B"]);
  });

  it("retorna lista vazia quando o usuário não tem membership", async () => {
    const { companyRepository } = build();
    const useCase = new ListCompanies(companyRepository);

    const companies = await useCase.execute({ userId: "sem-acesso" });

    expect(companies).toEqual([]);
  });
});

describe("GetCompany", () => {
  it("retorna a empresa quando o usuário tem acesso", async () => {
    const { companyRepository, membershipRepository } = build();
    const company = await companyRepository.create(seedCompany("Orbis"));
    await linkUser(membershipRepository, "user-1", company.id);

    const useCase = new GetCompany(
      companyRepository,
      new MembershipAccessService(membershipRepository),
    );

    const output = await useCase.execute({ userId: "user-1", companyId: company.id });

    expect(output.id).toBe(company.id);
    expect(output.name).toBe("Orbis");
  });

  it("lança ForbiddenError quando o usuário não tem membership", async () => {
    const { companyRepository, membershipRepository } = build();
    const company = await companyRepository.create(seedCompany("Orbis"));

    const useCase = new GetCompany(
      companyRepository,
      new MembershipAccessService(membershipRepository),
    );

    await expect(
      useCase.execute({ userId: "user-1", companyId: company.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança NotFoundError quando a empresa não existe mesmo com acesso", async () => {
    const { companyRepository, membershipRepository } = build();
    await linkUser(membershipRepository, "user-1", "company-inexistente");

    const useCase = new GetCompany(
      companyRepository,
      new MembershipAccessService(membershipRepository),
    );

    await expect(
      useCase.execute({ userId: "user-1", companyId: "company-inexistente" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("UpdateCompany", () => {
  it("atualiza campos quando o usuário tem acesso", async () => {
    const { companyRepository, membershipRepository } = build();
    const company = await companyRepository.create(seedCompany("Orbis"));
    await linkUser(membershipRepository, "user-1", company.id);

    const useCase = new UpdateCompany(
      companyRepository,
      new MembershipAccessService(membershipRepository),
    );

    const output = await useCase.execute({
      userId: "user-1",
      companyId: company.id,
      changes: { name: "Orbis SA", timezone: "America/New_York" },
    });

    expect(output.name).toBe("Orbis SA");
    expect(output.timezone).toBe("America/New_York");
  });

  it("rejeita mudanças vazias", async () => {
    const { companyRepository, membershipRepository } = build();
    const company = await companyRepository.create(seedCompany("Orbis"));
    await linkUser(membershipRepository, "user-1", company.id);

    const useCase = new UpdateCompany(
      companyRepository,
      new MembershipAccessService(membershipRepository),
    );

    await expect(
      useCase.execute({ userId: "user-1", companyId: company.id, changes: {} }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lança ForbiddenError sem membership", async () => {
    const { companyRepository, membershipRepository } = build();
    const company = await companyRepository.create(seedCompany("Orbis"));

    const useCase = new UpdateCompany(
      companyRepository,
      new MembershipAccessService(membershipRepository),
    );

    await expect(
      useCase.execute({ userId: "user-1", companyId: company.id, changes: { name: "X" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança NotFoundError quando a empresa não existe com acesso", async () => {
    const { companyRepository, membershipRepository } = build();
    await linkUser(membershipRepository, "user-1", "company-inexistente");

    const useCase = new UpdateCompany(
      companyRepository,
      new MembershipAccessService(membershipRepository),
    );

    await expect(
      useCase.execute({
        userId: "user-1",
        companyId: "company-inexistente",
        changes: { name: "X" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
