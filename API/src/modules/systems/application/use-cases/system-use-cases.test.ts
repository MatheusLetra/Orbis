import { describe, expect, it } from "vitest";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { MembershipPermissionResolver } from "@/modules/memberships/infrastructure/resolvers/membership-permission-resolver";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/typed-errors";
import { InMemorySystemRepository } from "@/test/fakes/catalog-fakes";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";
import { CreateSystem } from "./create-system";
import { DeleteSystem } from "./delete-system";
import { GetSystem } from "./get-system";
import { ListSystems } from "./list-systems";
import { UpdateSystem } from "./update-system";

function build() {
  const systemRepository = new InMemorySystemRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const resolver = new MembershipPermissionResolver(membershipRepository);
  return { systemRepository, membershipRepository, accessService, authorization, resolver };
}

async function actor(
  membershipRepository: InMemoryMembershipRepository,
  companyId: string,
): Promise<AuthenticatedUser> {
  await membershipRepository.create(
    Membership.create({ companyId, userId: "user-1", position: "GESTOR" }),
  );
  return new MembershipPermissionResolver(membershipRepository).resolve("user-1", companyId);
}

async function foreignActor(
  membershipRepository: InMemoryMembershipRepository,
  companyId: string,
): Promise<AuthenticatedUser> {
  await membershipRepository.create(
    Membership.create({ companyId, userId: "user-2", position: "GESTOR" }),
  );
  return new MembershipPermissionResolver(membershipRepository).resolve("user-2", companyId);
}

describe("CreateSystem", () => {
  it("cria um sistema na empresa do ator", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const useCase = new CreateSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");

    const output = await useCase.execute({ actor: user, data: { name: "ERP" } });

    expect(output.name).toBe("ERP");
    expect(output.companyId).toBe("company-1");
    expect(output.isActive).toBe(true);
  });

  it("lança 403 quando o ator não tem acesso à empresa", async () => {
    const { systemRepository, accessService, authorization } = build();
    const useCase = new CreateSystem(systemRepository, accessService, authorization);
    const user: AuthenticatedUser = {
      userId: "user-1",
      companyId: "company-2",
      permissions: ["systems.manage"],
    };

    await expect(useCase.execute({ actor: user, data: { name: "ERP" } })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("lança 403 sem permissão systems.manage", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const useCase = new CreateSystem(systemRepository, accessService, authorization);
    await membershipRepository.create(
      Membership.create({ companyId: "company-1", userId: "user-1", position: "SUPORTE" }),
    );
    const user = await new MembershipPermissionResolver(membershipRepository).resolve(
      "user-1",
      "company-1",
    );

    await expect(useCase.execute({ actor: user, data: { name: "ERP" } })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("lança ConflictError quando o nome já existe na empresa", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const useCase = new CreateSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    await useCase.execute({ actor: user, data: { name: "ERP" } });

    await expect(useCase.execute({ actor: user, data: { name: "ERP" } })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("lança ValidationError para nome em branco", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const useCase = new CreateSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");

    await expect(useCase.execute({ actor: user, data: { name: " " } })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("ListSystems", () => {
  it("lista apenas os sistemas da empresa do ator", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const useCase = new CreateSystem(systemRepository, accessService, authorization);
    const listUseCase = new ListSystems(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    await useCase.execute({ actor: user, data: { name: "ERP" } });
    await useCase.execute({ actor: user, data: { name: "CRM" } });

    const output = await listUseCase.execute({ actor: user });

    expect(output).toHaveLength(2);
    expect(output.map((system) => system.name)).toEqual(["CRM", "ERP"]);
  });

  it("lança 403 sem permissão systems.read", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const listUseCase = new ListSystems(systemRepository, accessService, authorization);
    await membershipRepository.create(
      Membership.create({ companyId: "company-1", userId: "user-1", position: "ESTAGIARIO" }),
    );
    const user = await new MembershipPermissionResolver(membershipRepository).resolve(
      "user-1",
      "company-1",
    );

    await expect(listUseCase.execute({ actor: user })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("GetSystem", () => {
  it("obtém um sistema da própria empresa", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const createUseCase = new CreateSystem(systemRepository, accessService, authorization);
    const getUseCase = new GetSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const created = await createUseCase.execute({ actor: user, data: { name: "ERP" } });

    const output = await getUseCase.execute({ actor: user, systemId: created.id });

    expect(output.id).toBe(created.id);
  });

  it("lança NotFoundError quando o sistema não pertence à empresa", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const createUseCase = new CreateSystem(systemRepository, accessService, authorization);
    const getUseCase = new GetSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const foreign = await foreignActor(membershipRepository, "company-2");
    const created = await createUseCase.execute({ actor: user, data: { name: "ERP" } });

    await expect(
      getUseCase.execute({ actor: foreign, systemId: created.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("UpdateSystem", () => {
  it("renomeia um sistema", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const createUseCase = new CreateSystem(systemRepository, accessService, authorization);
    const updateUseCase = new UpdateSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const created = await createUseCase.execute({ actor: user, data: { name: "ERP" } });

    const output = await updateUseCase.execute({
      actor: user,
      systemId: created.id,
      changes: { name: "ERP v2" },
    });

    expect(output.name).toBe("ERP v2");
  });

  it("lança ConflictError ao renomear para um nome existente", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const createUseCase = new CreateSystem(systemRepository, accessService, authorization);
    const updateUseCase = new UpdateSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const created = await createUseCase.execute({ actor: user, data: { name: "ERP" } });
    await createUseCase.execute({ actor: user, data: { name: "CRM" } });

    await expect(
      updateUseCase.execute({ actor: user, systemId: created.id, changes: { name: "CRM" } }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("lança ValidationError para corpo vazio", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const updateUseCase = new UpdateSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");

    await expect(
      updateUseCase.execute({ actor: user, systemId: "missing", changes: {} }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("DeleteSystem", () => {
  it("remove um sistema da empresa", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const createUseCase = new CreateSystem(systemRepository, accessService, authorization);
    const deleteUseCase = new DeleteSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const created = await createUseCase.execute({ actor: user, data: { name: "ERP" } });

    const output = await deleteUseCase.execute({ actor: user, systemId: created.id });

    expect(output.id).toBe(created.id);
    await expect(systemRepository.findById(created.id)).resolves.toBeNull();
  });

  it("lança NotFoundError para sistema de outra empresa", async () => {
    const { systemRepository, membershipRepository, accessService, authorization } = build();
    const createUseCase = new CreateSystem(systemRepository, accessService, authorization);
    const deleteUseCase = new DeleteSystem(systemRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const foreign = await foreignActor(membershipRepository, "company-2");
    const created = await createUseCase.execute({ actor: user, data: { name: "ERP" } });

    await expect(
      deleteUseCase.execute({ actor: foreign, systemId: created.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
