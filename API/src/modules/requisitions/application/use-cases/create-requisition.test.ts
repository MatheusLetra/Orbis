import { describe, expect, it, vi } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { RequisitionNumberGenerator } from "@/modules/requisitions/application/ports/requisition-number-generator";
import { CreateRequisition } from "@/modules/requisitions/application/use-cases/create-requisition";
import type { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { System } from "@/modules/systems/domain/entities/system";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import type { SystemVersion } from "@/modules/versions/domain/entities/system-version";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";
import {
  InMemorySystemRepository,
  InMemorySystemVersionRepository,
} from "@/test/fakes/catalog-fakes";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";

const ACTOR_ID = "actor-1";
const COMPANY_ID = "company-1";
const RESPONSIBLE_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SYSTEM_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";

class InMemoryRequisitionRepository implements RequisitionRepository {
  created: Requisition | null = null;

  async create(requisition: Requisition): Promise<Requisition> {
    this.created = requisition;
    return requisition;
  }

  async findById(id: string): Promise<Requisition | null> {
    return this.created?.id === id ? this.created : null;
  }

  async update(requisition: Requisition): Promise<Requisition> {
    this.created = requisition;
    return requisition;
  }

  async listByCompany(): Promise<Requisition[]> {
    return this.created ? [this.created] : [];
  }
}

function build() {
  const requisitionRepository = new InMemoryRequisitionRepository();
  const numberGenerator: RequisitionNumberGenerator = {
    next: vi.fn().mockResolvedValue(42),
  };
  const membershipRepository = new InMemoryMembershipRepository();
  const systemRepository = new InMemorySystemRepository();
  const systemVersionRepository = new InMemorySystemVersionRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const useCase = new CreateRequisition(
    requisitionRepository,
    numberGenerator,
    membershipRepository,
    systemRepository,
    systemVersionRepository,
    accessService,
    authorization,
  );

  return {
    useCase,
    requisitionRepository,
    numberGenerator,
    membershipRepository,
    systemRepository,
    systemVersionRepository,
  };
}

async function activeActor(
  membershipRepository: InMemoryMembershipRepository,
  companyId = COMPANY_ID,
): Promise<AuthenticatedUser> {
  await membershipRepository.create(
    Membership.create({ companyId, userId: ACTOR_ID, position: "GESTOR" }),
  );

  return {
    userId: ACTOR_ID,
    companyId,
    permissions: ["requisitions.create"],
  };
}

async function seedSystem(repository: SystemRepository, id: string, companyId = COMPANY_ID) {
  const system = {
    id,
    companyId,
    name: `System ${id}`,
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as System;
  await repository.create(system);
  return system;
}

async function seedVersion(
  repository: SystemVersionRepository,
  id: string,
  systemId: string,
  companyId = COMPANY_ID,
) {
  const version = {
    id,
    companyId,
    systemId,
    version: "1.0.0",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as SystemVersion;
  await repository.create(version);
  return version;
}

describe("CreateRequisition", () => {
  it("cria uma requisição mínima com companyId, requesterId, number e padrões do domínio", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    const output = await dependencies.useCase.execute({
      actor,
      data: { title: "Nova requisição" },
    });

    expect(output.companyId).toBe(COMPANY_ID);
    expect(output.requesterId).toBe(ACTOR_ID);
    expect(output.number).toBe(42);
    expect(output.priority).toBe("MEDIUM");
    expect(output.status).toBe("OPEN");
    expect(dependencies.requisitionRepository.created?.companyId).toBe(COMPANY_ID);
  });

  it("preserva dados opcionais válidos", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await dependencies.membershipRepository.create(
      Membership.create({
        companyId: COMPANY_ID,
        userId: RESPONSIBLE_ID,
        position: "DESENVOLVEDOR",
      }),
    );
    await seedSystem(dependencies.systemRepository, SYSTEM_ID);
    await seedVersion(dependencies.systemVersionRepository, VERSION_ID, SYSTEM_ID);
    const startDate = new Date("2026-08-11T00:00:00Z");

    const output = await dependencies.useCase.execute({
      actor,
      data: {
        title: "Requisição completa",
        description: "Descrição",
        priority: "HIGH",
        responsibleId: RESPONSIBLE_ID,
        systemId: SYSTEM_ID,
        systemVersionId: VERSION_ID,
        estimatedHours: 8,
        startDate,
      },
    });

    expect(output.description).toBe("Descrição");
    expect(output.responsibleId).toBe(RESPONSIBLE_ID);
    expect(output.systemId).toBe(SYSTEM_ID);
    expect(output.systemVersionId).toBe(VERSION_ID);
    expect(output.estimatedHours).toBe(8);
    expect(output.startDate).toBe(startDate.toISOString());
  });

  it("permite systemVersionId sem systemId, validando existência e tenant", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await seedVersion(dependencies.systemVersionRepository, VERSION_ID, SYSTEM_ID);

    const output = await dependencies.useCase.execute({
      actor,
      data: { title: "Versão relacionada", systemVersionId: VERSION_ID },
    });

    expect(output.systemId).toBeNull();
    expect(output.systemVersionId).toBe(VERSION_ID);
  });

  it("lança ValidationError para payload inválido", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    await expect(
      dependencies.useCase.execute({ actor, data: { title: " " } }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(dependencies.numberGenerator.next).not.toHaveBeenCalled();
  });

  it("lança ForbiddenError sem permissão", async () => {
    const dependencies = build();
    await dependencies.membershipRepository.create(
      Membership.create({ companyId: COMPANY_ID, userId: ACTOR_ID, position: "SUPORTE" }),
    );

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: [] },
        data: { title: "Sem permissão" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(dependencies.numberGenerator.next).not.toHaveBeenCalled();
  });

  it("lança ForbiddenError para membership inativa", async () => {
    const dependencies = build();
    const membership = Membership.create({
      companyId: COMPANY_ID,
      userId: ACTOR_ID,
      position: "GESTOR",
    });
    membership.deactivate();
    await dependencies.membershipRepository.create(membership);

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: ["requisitions.create"] },
        data: { title: "Membership inativa" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(dependencies.numberGenerator.next).not.toHaveBeenCalled();
  });

  it.each([
    ["responsibleId", { responsibleId: RESPONSIBLE_ID }],
    ["systemId", { systemId: SYSTEM_ID }],
    ["systemVersionId", { systemVersionId: VERSION_ID }],
  ])("lança NotFoundError para %s inexistente", async (_field, data) => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    await expect(
      dependencies.useCase.execute({ actor, data: { title: "Referência ausente", ...data } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.numberGenerator.next).not.toHaveBeenCalled();
  });

  it("lança NotFoundError para responsibleId de outro tenant", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await dependencies.membershipRepository.create(
      Membership.create({
        companyId: "company-2",
        userId: RESPONSIBLE_ID,
        position: "DESENVOLVEDOR",
      }),
    );

    await expect(
      dependencies.useCase.execute({
        actor,
        data: { title: "Responsável externo", responsibleId: RESPONSIBLE_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.numberGenerator.next).not.toHaveBeenCalled();
  });

  it("lança NotFoundError para systemId de outro tenant", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await seedSystem(dependencies.systemRepository, SYSTEM_ID, "company-2");

    await expect(
      dependencies.useCase.execute({
        actor,
        data: { title: "Sistema externo", systemId: SYSTEM_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.numberGenerator.next).not.toHaveBeenCalled();
  });

  it("lança NotFoundError para systemVersionId de outro tenant", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await seedVersion(dependencies.systemVersionRepository, VERSION_ID, SYSTEM_ID, "company-2");

    await expect(
      dependencies.useCase.execute({
        actor,
        data: { title: "Versão externa", systemVersionId: VERSION_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.numberGenerator.next).not.toHaveBeenCalled();
  });

  it("lança NotFoundError quando a versão não pertence ao sistema informado", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await seedSystem(dependencies.systemRepository, SYSTEM_ID);
    await seedSystem(dependencies.systemRepository, OTHER_SYSTEM_ID);
    await seedVersion(dependencies.systemVersionRepository, VERSION_ID, OTHER_SYSTEM_ID);

    await expect(
      dependencies.useCase.execute({
        actor,
        data: { title: "Versão incompatível", systemId: SYSTEM_ID, systemVersionId: VERSION_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.numberGenerator.next).not.toHaveBeenCalled();
  });

  it("chama o generator somente após as validações e persiste a entidade correta", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const generator = vi.mocked(dependencies.numberGenerator.next);

    await dependencies.useCase.execute({ actor, data: { title: "Requisição criada" } });

    expect(generator).toHaveBeenCalledWith(COMPANY_ID);
    expect(dependencies.requisitionRepository.created).toMatchObject({
      companyId: COMPANY_ID,
      requesterId: ACTOR_ID,
      number: 42,
      title: "Requisição criada",
      status: "OPEN",
      priority: "MEDIUM",
    });
  });
});
