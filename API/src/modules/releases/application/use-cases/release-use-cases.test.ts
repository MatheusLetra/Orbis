import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { MembershipPermissionResolver } from "@/modules/memberships/infrastructure/resolvers/membership-permission-resolver";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { System } from "@/modules/systems/domain/entities/system";
import { SystemVersion } from "@/modules/versions/domain/entities/system-version";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/typed-errors";
import {
  InMemoryArtifactStorage,
  InMemoryReleaseRepository,
  InMemorySystemRepository,
  InMemorySystemVersionRepository,
} from "@/test/fakes/catalog-fakes";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";
import { CreateRelease } from "./create-release";
import { DeleteRelease } from "./delete-release";
import { GetRelease } from "./get-release";
import { ListReleases } from "./list-releases";
import { PublishRelease } from "./publish-release";

function build() {
  const releaseRepository = new InMemoryReleaseRepository();
  const systemVersionRepository = new InMemorySystemVersionRepository();
  const systemRepository = new InMemorySystemRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const artifactStorage = new InMemoryArtifactStorage();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const resolver = new MembershipPermissionResolver(membershipRepository);
  return {
    releaseRepository,
    systemVersionRepository,
    systemRepository,
    membershipRepository,
    artifactStorage,
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

async function seedVersion(
  systemRepository: InMemorySystemRepository,
  systemVersionRepository: InMemorySystemVersionRepository,
  companyId: string,
) {
  const system = System.create({ companyId, name: "ERP" });
  await systemRepository.create(system);
  const version = SystemVersion.create({ companyId, systemId: system.id, version: "1.0.0" });
  await systemVersionRepository.create(version);
  return version;
}

describe("CreateRelease", () => {
  it("cria uma release em rascunho vinculada à versão", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const useCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");

    const output = await useCase.execute({
      actor: user,
      data: { systemVersionId: version.id, versionLabel: "1.0.0" },
    });

    expect(output.status).toBe("DRAFT");
    expect(output.systemVersionId).toBe(version.id);
    expect(output.versionLabel).toBe("1.0.0");
    expect(output.channel).toBe("STABLE");
    expect(output.createdBy).toBe("user-1");
  });

  it("lança NotFoundError quando a versão não pertence à empresa", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const useCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const foreign = await foreignActor(membershipRepository, "company-2");
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");

    await expect(
      useCase.execute({
        actor: foreign,
        data: { systemVersionId: version.id, versionLabel: "1.0.0" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança ForbiddenError sem permissão releases.manage", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const useCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
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
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");

    await expect(
      useCase.execute({
        actor: user,
        data: { systemVersionId: version.id, versionLabel: "1.0.0" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança ValidationError para systemVersionId inválido", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const useCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");

    await expect(
      useCase.execute({
        actor: user,
        data: { systemVersionId: "not-a-uuid", versionLabel: "1.0.0" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("ListReleases", () => {
  it("lista apenas releases da empresa do ator", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const listUseCase = new ListReleases(releaseRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");
    await createUseCase.execute({
      actor: user,
      data: { systemVersionId: version.id, versionLabel: "1.0.0" },
    });

    const output = await listUseCase.execute({ actor: user });

    expect(output).toHaveLength(1);
    expect(output[0].versionLabel).toBe("1.0.0");
  });
});

describe("GetRelease", () => {
  it("obtém uma release da própria empresa", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const getUseCase = new GetRelease(releaseRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");
    const created = await createUseCase.execute({
      actor: user,
      data: { systemVersionId: version.id, versionLabel: "1.0.0" },
    });

    const output = await getUseCase.execute({ actor: user, releaseId: created.id });

    expect(output.id).toBe(created.id);
  });

  it("lança NotFoundError para release de outra empresa", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const getUseCase = new GetRelease(releaseRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const foreign = await foreignActor(membershipRepository, "company-2");
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");
    const created = await createUseCase.execute({
      actor: user,
      data: { systemVersionId: version.id, versionLabel: "1.0.0" },
    });

    await expect(
      getUseCase.execute({ actor: foreign, releaseId: created.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("PublishRelease", () => {
  async function publishSetup() {
    const context = build();
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
    } = context;
    const createUseCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const publishUseCase = new PublishRelease(
      releaseRepository,
      context.artifactStorage,
      accessService,
      authorization,
    );
    const user = await actor(membershipRepository, "company-1");
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");
    const created = await createUseCase.execute({
      actor: user,
      data: { systemVersionId: version.id, versionLabel: "1.0.0" },
    });
    return { context, user, created, publishUseCase };
  }

  it("publica a release, grava o artefato no storage e atualiza os metadados", async () => {
    const { context, user, created, publishUseCase } = await publishSetup();
    const content = Buffer.from("conteudo-do-artefato");
    const checksum = createHash("sha256").update(content).digest("hex");

    const output = await publishUseCase.execute({
      actor: user,
      releaseId: created.id,
      data: { artifactName: "app.exe", contentBase64: content.toString("base64") },
    });

    expect(output.status).toBe("PUBLISHED");
    expect(output.artifactName).toBe("app.exe");
    expect(output.checksum).toBe(checksum);
    expect(output.sizeBytes).toBe(content.byteLength);
    expect(output.publishedAt).not.toBeNull();
    expect(output.storageKey).toContain("company-1/");
    expect(context.artifactStorage.has(output.storageKey ?? "")).toBe(true);
    expect(await context.artifactStorage.read(output.storageKey ?? "")).toEqual(content);
  });

  it("lança BusinessRuleError ao republicar uma release publicada", async () => {
    const { user, created, publishUseCase } = await publishSetup();
    const content = Buffer.from("x").toString("base64");
    await publishUseCase.execute({
      actor: user,
      releaseId: created.id,
      data: { artifactName: "app.exe", contentBase64: content },
    });

    await expect(
      publishUseCase.execute({
        actor: user,
        releaseId: created.id,
        data: { artifactName: "app.exe", contentBase64: content },
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("lança ValidationError para artifactName em branco", async () => {
    const { user, created, publishUseCase } = await publishSetup();

    await expect(
      publishUseCase.execute({
        actor: user,
        releaseId: created.id,
        data: { artifactName: " ", contentBase64: "eA==" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lança NotFoundError para release inexistente", async () => {
    const { user, publishUseCase } = await publishSetup();

    await expect(
      publishUseCase.execute({
        actor: user,
        releaseId: "missing",
        data: { artifactName: "app.exe", contentBase64: "eA==" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança ForbiddenError sem permissão releases.manage", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
      artifactStorage,
    } = build();
    const createUseCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const publishUseCase = new PublishRelease(
      releaseRepository,
      artifactStorage,
      accessService,
      authorization,
    );
    const manager = await actor(membershipRepository, "company-1");
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");
    const created = await createUseCase.execute({
      actor: manager,
      data: { systemVersionId: version.id, versionLabel: "1.0.0" },
    });
    await membershipRepository.create(
      Membership.create({ companyId: "company-1", userId: "user-2", position: "SUPORTE" }),
    );
    const user = await new MembershipPermissionResolver(membershipRepository).resolve(
      "user-2",
      "company-1",
    );

    await expect(
      publishUseCase.execute({
        actor: user,
        releaseId: created.id,
        data: { artifactName: "app.exe", contentBase64: "eA==" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("DeleteRelease", () => {
  it("remove uma release", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const deleteUseCase = new DeleteRelease(releaseRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");
    const created = await createUseCase.execute({
      actor: user,
      data: { systemVersionId: version.id, versionLabel: "1.0.0" },
    });

    const output = await deleteUseCase.execute({ actor: user, releaseId: created.id });

    expect(output.id).toBe(created.id);
    await expect(releaseRepository.findById(created.id)).resolves.toBeNull();
  });

  it("lança NotFoundError para release de outra empresa", async () => {
    const {
      releaseRepository,
      systemVersionRepository,
      systemRepository,
      membershipRepository,
      accessService,
      authorization,
    } = build();
    const createUseCase = new CreateRelease(
      releaseRepository,
      systemVersionRepository,
      accessService,
      authorization,
    );
    const deleteUseCase = new DeleteRelease(releaseRepository, accessService, authorization);
    const user = await actor(membershipRepository, "company-1");
    const foreign = await foreignActor(membershipRepository, "company-2");
    const version = await seedVersion(systemRepository, systemVersionRepository, "company-1");
    const created = await createUseCase.execute({
      actor: user,
      data: { systemVersionId: version.id, versionLabel: "1.0.0" },
    });

    await expect(
      deleteUseCase.execute({ actor: foreign, releaseId: created.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
