import { describe, expect, it } from "vitest";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { MembershipPermissionResolver } from "@/modules/memberships/infrastructure/resolvers/membership-permission-resolver";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { System } from "@/modules/systems/domain/entities/system";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/typed-errors";
import {
  InMemorySystemRepository,
  InMemorySystemVersionRepository,
} from "@/test/fakes/catalog-fakes";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";
import { CreateSystemVersion } from "./create-system-version";
import { DeleteSystemVersion } from "./delete-system-version";
import { GetSystemVersion } from "./get-system-version";
import { ListSystemVersions } from "./list-system-versions";
import { UpdateSystemVersion } from "./update-system-version";

function build() {
  const systemRepository = new InMemorySystemRepository();
  const systemVersionRepository = new InMemorySystemVersionRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const resolver = new MembershipPermissionResolver(membershipRepository);
  return {
    systemRepository,
    systemVersionRepository,
    membershipRepository,
    accessService,
    authorization,
    resolver,
  };
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

async function seedSystem(systemRepository: InMemorySystemRepository, companyId: string) {
  const system = System.create({ companyId, name: "ERP" });
  await systemRepository.create(system);
  return system;
}

describe("CreateSystemVersion", () => {
  it("cria uma versão para um sistema da empresa", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const useCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");
    const system = await seedSystem(systemRepository, "company-1");

    const output = await useCase.execute({
      actor: user,
      systemId: system.id,
      data: { version: "1.0.0" },
    });

    expect(output.version).toBe("1.0.0");
    expect(output.systemId).toBe(system.id);
    expect(output.companyId).toBe("company-1");
  });

  it("lança NotFoundError quando o sistema não existe", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const useCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");

    await expect(
      useCase.execute({ actor: user, systemId: "missing", data: { version: "1.0.0" } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança ConflictError quando a versão já existe no sistema", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const useCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");
    const system = await seedSystem(systemRepository, "company-1");
    await useCase.execute({ actor: user, systemId: system.id, data: { version: "1.0.0" } });

    await expect(
      useCase.execute({ actor: user, systemId: system.id, data: { version: "1.0.0" } }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("lança ForbiddenError sem permissão versions.manage", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const useCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    await membershipRepository.create(
      Membership.create({ companyId: "company-1", userId: "user-1", position: "SUPORTE" }),
    );
    const user = await new MembershipPermissionResolver(membershipRepository).resolve(
      "user-1",
      "company-1",
    );
    const system = await seedSystem(systemRepository, "company-1");

    await expect(
      useCase.execute({ actor: user, systemId: system.id, data: { version: "1.0.0" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança ValidationError para versão em branco", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const useCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");
    const system = await seedSystem(systemRepository, "company-1");

    await expect(
      useCase.execute({ actor: user, systemId: system.id, data: { version: " " } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("ListSystemVersions", () => {
  it("lista as versões de um sistema", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const listUseCase = new ListSystemVersions(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");
    const system = await seedSystem(systemRepository, "company-1");
    await createUseCase.execute({ actor: user, systemId: system.id, data: { version: "1.1.0" } });
    await createUseCase.execute({ actor: user, systemId: system.id, data: { version: "1.0.0" } });

    const output = await listUseCase.execute({ actor: user, systemId: system.id });

    expect(output.map((version) => version.version)).toEqual(["1.0.0", "1.1.0"]);
  });

  it("lança NotFoundError quando o sistema não pertence à empresa", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const listUseCase = new ListSystemVersions(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const foreign = await foreignActor(membershipRepository, "company-2");
    const system = await seedSystem(systemRepository, "company-1");

    await expect(
      listUseCase.execute({ actor: foreign, systemId: system.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("GetSystemVersion", () => {
  it("obtém uma versão da própria empresa", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const getUseCase = new GetSystemVersion(systemVersionRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const system = await seedSystem(systemRepository, "company-1");
    const created = await createUseCase.execute({
      actor: user,
      systemId: system.id,
      data: { version: "1.0.0" },
    });

    const output = await getUseCase.execute({ actor: user, versionId: created.id });

    expect(output.id).toBe(created.id);
  });

  it("lança NotFoundError para versão de outra empresa", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const getUseCase = new GetSystemVersion(systemVersionRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const foreign = await foreignActor(membershipRepository, "company-2");
    const system = await seedSystem(systemRepository, "company-1");
    const created = await createUseCase.execute({
      actor: user,
      systemId: system.id,
      data: { version: "1.0.0" },
    });

    await expect(
      getUseCase.execute({ actor: foreign, versionId: created.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("UpdateSystemVersion", () => {
  it("atualiza a versão", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const updateUseCase = new UpdateSystemVersion(
      systemVersionRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");
    const system = await seedSystem(systemRepository, "company-1");
    const created = await createUseCase.execute({
      actor: user,
      systemId: system.id,
      data: { version: "1.0.0" },
    });

    const output = await updateUseCase.execute({
      actor: user,
      versionId: created.id,
      changes: { version: "1.0.1" },
    });

    expect(output.version).toBe("1.0.1");
  });

  it("lança ConflictError ao duplicar versão no sistema", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const updateUseCase = new UpdateSystemVersion(
      systemVersionRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");
    const system = await seedSystem(systemRepository, "company-1");
    await createUseCase.execute({ actor: user, systemId: system.id, data: { version: "1.0.0" } });
    const second = await createUseCase.execute({
      actor: user,
      systemId: system.id,
      data: { version: "1.0.1" },
    });

    await expect(
      updateUseCase.execute({
        actor: user,
        versionId: second.id,
        changes: { version: "1.0.0" },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("DeleteSystemVersion", () => {
  it("remove uma versão", async () => {
    const {
      systemRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateSystemVersion(
      systemVersionRepository,
      systemRepository,
      accessService,
      authorization,
    );
    const deleteUseCase = new DeleteSystemVersion(
      systemVersionRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");
    const system = await seedSystem(systemRepository, "company-1");
    const created = await createUseCase.execute({
      actor: user,
      systemId: system.id,
      data: { version: "1.0.0" },
    });

    const output = await deleteUseCase.execute({ actor: user, versionId: created.id });

    expect(output.id).toBe(created.id);
    await expect(systemVersionRepository.findById(created.id)).resolves.toBeNull();
  });
});
