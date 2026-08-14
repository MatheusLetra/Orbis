import { describe, expect, it } from "vitest";
import { Company } from "@/modules/companies/domain/entities/company";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { MembershipPermissionResolver } from "@/modules/memberships/infrastructure/resolvers/membership-permission-resolver";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { User } from "@/modules/users/domain/entities/user";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/typed-errors";
import {
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
  InMemoryUserRepository,
} from "@/test/fakes/identity-fakes";
import { CreateMembership } from "./create-membership";
import { ListCompanyMembers } from "./list-company-members";
import { ListMemberships } from "./list-memberships";

async function build() {
  const companyRepository = new InMemoryCompanyRepository();
  const userRepository = new InMemoryUserRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const resolver = new MembershipPermissionResolver(membershipRepository);

  const company = await companyRepository.create(Company.create({ name: "Orbis Corp" }));
  const user = await userRepository.create(
    User.create({ email: "dev@orbis.com", name: "Ana", passwordHash: "scrypt:abc" }),
  );

  return {
    companyRepository,
    userRepository,
    membershipRepository,
    accessService,
    authorization,
    resolver,
    company,
    user,
  };
}

async function actorFor(
  build: Awaited<ReturnType<typeof build>>,
  userId: string,
  position: string,
) {
  await build.membershipRepository.create(
    Membership.create({ companyId: build.company.id, userId, position }),
  );
  return build.resolver.resolve(userId, build.company.id);
}

describe("CreateMembership", () => {
  it("cria o vínculo entre usuário e empresa com cargo", async () => {
    const ctx = await build();
    const actor = await actorFor(ctx, "gestor-1", "GESTOR");
    const useCase = new CreateMembership(
      ctx.membershipRepository,
      ctx.companyRepository,
      ctx.userRepository,
      ctx.accessService,
      ctx.authorization,
    );

    const output = await useCase.execute({
      actor,
      data: { companyId: ctx.company.id, userId: ctx.user.id, position: "DESENVOLVEDOR" },
    });

    expect(output.companyId).toBe(ctx.company.id);
    expect(output.userId).toBe(ctx.user.id);
    expect(output.position).toBe("DESENVOLVEDOR");
    expect(output.isActive).toBe(true);
  });

  it("rejeita cargo vazio", async () => {
    const ctx = await build();
    const actor = await actorFor(ctx, "gestor-1", "GESTOR");
    const useCase = new CreateMembership(
      ctx.membershipRepository,
      ctx.companyRepository,
      ctx.userRepository,
      ctx.accessService,
      ctx.authorization,
    );

    await expect(
      useCase.execute({
        actor,
        data: { companyId: ctx.company.id, userId: ctx.user.id, position: "  " },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejeita ids que não são uuid", async () => {
    const ctx = await build();
    const actor = await actorFor(ctx, "gestor-1", "GESTOR");
    const useCase = new CreateMembership(
      ctx.membershipRepository,
      ctx.companyRepository,
      ctx.userRepository,
      ctx.accessService,
      ctx.authorization,
    );

    await expect(
      useCase.execute({
        actor,
        data: { companyId: "nao-uuid", userId: "nao-uuid", position: "GESTOR" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lança ForbiddenError quando o ator não possui acesso à empresa", async () => {
    const ctx = await build();

    await expect(ctx.resolver.resolve("gestor-1", ctx.company.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("lança ForbiddenError quando o ator não possui users.manage", async () => {
    const ctx = await build();
    const actor = await actorFor(ctx, "suporte-1", "SUPORTE");
    const useCase = new CreateMembership(
      ctx.membershipRepository,
      ctx.companyRepository,
      ctx.userRepository,
      ctx.accessService,
      ctx.authorization,
    );

    await expect(
      useCase.execute({
        actor,
        data: { companyId: ctx.company.id, userId: ctx.user.id, position: "GESTOR" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança NotFoundError quando a empresa não existe", async () => {
    const ctx = await build();
    const missingCompanyId = "00000000-0000-4000-8000-000000000001";
    await ctx.membershipRepository.create(
      Membership.create({ companyId: missingCompanyId, userId: "gestor-1", position: "GESTOR" }),
    );
    const actor = await ctx.resolver.resolve("gestor-1", missingCompanyId);
    const useCase = new CreateMembership(
      ctx.membershipRepository,
      ctx.companyRepository,
      ctx.userRepository,
      ctx.accessService,
      ctx.authorization,
    );

    await expect(
      useCase.execute({
        actor,
        data: {
          companyId: missingCompanyId,
          userId: ctx.user.id,
          position: "GESTOR",
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança NotFoundError quando o usuário não existe", async () => {
    const ctx = await build();
    const actor = await actorFor(ctx, "gestor-1", "GESTOR");
    const useCase = new CreateMembership(
      ctx.membershipRepository,
      ctx.companyRepository,
      ctx.userRepository,
      ctx.accessService,
      ctx.authorization,
    );

    await expect(
      useCase.execute({
        actor,
        data: {
          companyId: ctx.company.id,
          userId: "00000000-0000-4000-8000-000000000002",
          position: "GESTOR",
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança ConflictError quando já existe membership", async () => {
    const ctx = await build();
    const actor = await actorFor(ctx, "gestor-1", "GESTOR");
    const useCase = new CreateMembership(
      ctx.membershipRepository,
      ctx.companyRepository,
      ctx.userRepository,
      ctx.accessService,
      ctx.authorization,
    );

    await useCase.execute({
      actor,
      data: { companyId: ctx.company.id, userId: ctx.user.id, position: "GESTOR" },
    });

    await expect(
      useCase.execute({
        actor,
        data: { companyId: ctx.company.id, userId: ctx.user.id, position: "SUPORTE" },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("ListMemberships", () => {
  it("lista as memberships do usuário", async () => {
    const ctx = await build();
    const actor = await actorFor(ctx, "gestor-1", "GESTOR");
    const useCase = new CreateMembership(
      ctx.membershipRepository,
      ctx.companyRepository,
      ctx.userRepository,
      ctx.accessService,
      ctx.authorization,
    );
    await useCase.execute({
      actor,
      data: { companyId: ctx.company.id, userId: ctx.user.id, position: "GESTOR" },
    });

    const listUseCase = new ListMemberships(ctx.membershipRepository);
    const output = await listUseCase.execute({ userId: ctx.user.id });

    expect(output).toHaveLength(1);
    expect(output[0]?.companyId).toBe(ctx.company.id);
  });
});

describe("ListCompanyMembers", () => {
  it("rejeita pesquisa acima do limite", async () => {
    const ctx = await build();
    const actor = await actorFor(ctx, "gestor-1", "GESTOR");
    const repository = { listActiveByCompany: async () => [] };
    const useCase = new ListCompanyMembers(repository, ctx.accessService, ctx.authorization);

    await expect(useCase.execute({ actor, search: "a".repeat(201) })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
