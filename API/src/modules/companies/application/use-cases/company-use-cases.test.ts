import { describe, expect, it } from "vitest";
import { Company } from "@/modules/companies/domain/entities/company";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { MembershipPermissionResolver } from "@/modules/memberships/infrastructure/resolvers/membership-permission-resolver";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";
import {
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
} from "@/test/fakes/identity-fakes";
import { CreateCompany } from "./create-company";
import { GetCompany } from "./get-company";
import { ListCompanies } from "./list-companies";
import { UpdateCompany } from "./update-company";

function build() {
  const companyRepository = new InMemoryCompanyRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const resolver = new MembershipPermissionResolver(membershipRepository);
  return { companyRepository, membershipRepository, accessService, authorization, resolver };
}

function seedCompany(name: string) {
  return Company.create({ name });
}

async function linkUser(
  membershipRepository: InMemoryMembershipRepository,
  userId: string,
  companyId: string,
  position = "ADMINISTRADOR",
) {
  await membershipRepository.create(Membership.create({ companyId, userId, position }));
}

describe("CreateCompany", () => {
  it("cria uma empresa com timezone padrão e membership do dono", async () => {
    const { companyRepository, membershipRepository } = build();
    const useCase = new CreateCompany(companyRepository, membershipRepository);

    const output = await useCase.execute({
      ownerId: "user-1",
      company: { name: "Orbis Corp" },
    });

    expect(output.name).toBe("Orbis Corp");
    expect(output.timezone).toBe("America/Sao_Paulo");
    expect(output.isActive).toBe(true);
    expect(output.id).toBeTypeOf("string");

    const membership = await membershipRepository.findByUserAndCompany("user-1", output.id);
    expect(membership).not.toBeNull();
    expect(membership?.position).toBe("GESTOR");
  });

  it("valida entrada inválida", async () => {
    const { companyRepository, membershipRepository } = build();
    const useCase = new CreateCompany(companyRepository, membershipRepository);

    await expect(
      useCase.execute({ ownerId: "user-1", company: { name: "  " } }),
    ).rejects.toBeInstanceOf(ValidationError);
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
  it("retorna a empresa quando o usuário tem acesso e permissão", async () => {
    const { companyRepository, membershipRepository, accessService, authorization, resolver } =
      build();
    const company = await companyRepository.create(seedCompany("Orbis"));
    await linkUser(membershipRepository, "user-1", company.id);
    const actor = await resolver.resolve("user-1", company.id);

    const useCase = new GetCompany(companyRepository, accessService, authorization);

    const output = await useCase.execute({ actor, companyId: company.id });

    expect(output.id).toBe(company.id);
    expect(output.name).toBe("Orbis");
  });

  it("lança ForbiddenError quando o usuário não tem membership", async () => {
    const { companyRepository, resolver } = build();
    const company = await companyRepository.create(seedCompany("Orbis"));

    await expect(resolver.resolve("user-1", company.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança ForbiddenError quando o usuário não possui company.read", async () => {
    const { companyRepository, membershipRepository, accessService, authorization, resolver } =
      build();
    const company = await companyRepository.create(seedCompany("Orbis"));
    await linkUser(membershipRepository, "user-1", company.id, "ESTAGIARIO");
    const actor = await resolver.resolve("user-1", company.id);

    const useCase = new GetCompany(companyRepository, accessService, authorization);

    await expect(useCase.execute({ actor, companyId: company.id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("lança NotFoundError quando a empresa não existe mesmo com acesso", async () => {
    const { companyRepository, membershipRepository, accessService, authorization } = build();
    await linkUser(membershipRepository, "user-1", "company-inexistente");
    const actor: AuthenticatedUser = {
      userId: "user-1",
      companyId: "company-inexistente",
      permissions: ["company.read"],
    };

    const useCase = new GetCompany(companyRepository, accessService, authorization);

    await expect(
      useCase.execute({ actor, companyId: "company-inexistente" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("UpdateCompany", () => {
  it("atualiza campos quando o usuário tem acesso e permissão", async () => {
    const { companyRepository, membershipRepository, accessService, authorization, resolver } =
      build();
    const company = await companyRepository.create(seedCompany("Orbis"));
    await linkUser(membershipRepository, "user-1", company.id);
    const actor = await resolver.resolve("user-1", company.id);

    const useCase = new UpdateCompany(companyRepository, accessService, authorization);

    const output = await useCase.execute({
      actor,
      companyId: company.id,
      changes: { name: "Orbis SA", timezone: "America/New_York" },
    });

    expect(output.name).toBe("Orbis SA");
    expect(output.timezone).toBe("America/New_York");
  });

  it("rejeita mudanças vazias", async () => {
    const { companyRepository, membershipRepository, accessService, authorization, resolver } =
      build();
    const company = await companyRepository.create(seedCompany("Orbis"));
    await linkUser(membershipRepository, "user-1", company.id);
    const actor = await resolver.resolve("user-1", company.id);

    const useCase = new UpdateCompany(companyRepository, accessService, authorization);

    await expect(
      useCase.execute({ actor, companyId: company.id, changes: {} }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lança ForbiddenError sem membership", async () => {
    const { companyRepository, resolver } = build();
    const company = await companyRepository.create(seedCompany("Orbis"));

    await expect(resolver.resolve("user-1", company.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança ForbiddenError quando o usuário não possui company.update", async () => {
    const { companyRepository, membershipRepository, accessService, authorization, resolver } =
      build();
    const company = await companyRepository.create(seedCompany("Orbis"));
    await linkUser(membershipRepository, "user-1", company.id, "ESTAGIARIO");
    const actor = await resolver.resolve("user-1", company.id);

    const useCase = new UpdateCompany(companyRepository, accessService, authorization);

    await expect(
      useCase.execute({ actor, companyId: company.id, changes: { name: "X" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança ForbiddenError quando o contexto de empresa diverge", async () => {
    const { companyRepository, membershipRepository, accessService, authorization, resolver } =
      build();
    const company = await companyRepository.create(seedCompany("Orbis"));
    await linkUser(membershipRepository, "user-1", company.id);
    const actor = await resolver.resolve("user-1", company.id);

    const useCase = new UpdateCompany(companyRepository, accessService, authorization);

    await expect(
      useCase.execute({ actor, companyId: "outra-empresa", changes: { name: "X" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança NotFoundError quando a empresa não existe com acesso", async () => {
    const { companyRepository, membershipRepository, accessService, authorization } = build();
    await linkUser(membershipRepository, "user-1", "company-inexistente");
    const actor: AuthenticatedUser = {
      userId: "user-1",
      companyId: "company-inexistente",
      permissions: ["company.read", "company.update"],
    };

    const useCase = new UpdateCompany(companyRepository, accessService, authorization);

    await expect(
      useCase.execute({
        actor,
        companyId: "company-inexistente",
        changes: { name: "X" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
