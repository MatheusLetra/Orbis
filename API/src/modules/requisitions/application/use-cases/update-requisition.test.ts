import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { UpdateRequisition } from "@/modules/requisitions/application/use-cases/update-requisition";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { System } from "@/modules/systems/domain/entities/system";
import type { SystemVersion } from "@/modules/versions/domain/entities/system-version";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";
import {
  InMemorySystemRepository,
  InMemorySystemVersionRepository,
} from "@/test/fakes/catalog-fakes";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";

const ACTOR_ID = "actor-1";
const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";
const RESPONSIBLE_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SYSTEM_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";

class InMemoryRequisitionRepository implements RequisitionRepository {
  private readonly items = new Map<string, Requisition>();
  updated: Requisition | null = null;

  seed(requisition: Requisition): void {
    this.items.set(requisition.id, requisition);
  }

  async create(requisition: Requisition): Promise<Requisition> {
    this.items.set(requisition.id, requisition);
    return requisition;
  }

  async findById(id: string): Promise<Requisition | null> {
    return this.items.get(id) ?? null;
  }

  async update(requisition: Requisition): Promise<Requisition> {
    this.items.set(requisition.id, requisition);
    this.updated = requisition;
    return requisition;
  }

  async listByCompany(): Promise<Requisition[]> {
    return [];
  }
}

function build() {
  const requisitionRepository = new InMemoryRequisitionRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const systemRepository = new InMemorySystemRepository();
  const systemVersionRepository = new InMemorySystemVersionRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const useCase = new UpdateRequisition(
    requisitionRepository,
    membershipRepository,
    systemRepository,
    systemVersionRepository,
    accessService,
    authorization,
  );

  return {
    useCase,
    requisitionRepository,
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
    permissions: ["requisitions.update"],
  };
}

function requisition(overrides: Partial<Parameters<typeof Requisition.restore>[0]> = {}) {
  const now = new Date("2026-08-11T10:00:00Z");
  return Requisition.restore({
    id: "requisition-1",
    companyId: COMPANY_ID,
    number: 7,
    title: "Título original",
    description: "Descrição original",
    priority: "LOW",
    status: "OPEN",
    requesterId: "requester-1",
    responsibleId: null,
    systemId: null,
    systemVersionId: null,
    estimatedHours: 4,
    startDate: new Date("2026-08-12T00:00:00Z"),
    plannedDeliveryDate: new Date("2026-08-13T00:00:00Z"),
    deliveredAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

async function seedSystem(repository: InMemorySystemRepository, companyId = COMPANY_ID) {
  const system = {
    id: SYSTEM_ID,
    companyId,
    name: "ERP",
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as System;
  await repository.create(system);
  return system;
}

async function seedVersion(
  repository: InMemorySystemVersionRepository,
  systemId = SYSTEM_ID,
  companyId = COMPANY_ID,
) {
  const version = {
    id: VERSION_ID,
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

describe("UpdateRequisition", () => {
  it("altera title e mantém os campos não enviados", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);
    const before = current.updatedAt;

    const output = await dependencies.useCase.execute({
      actor,
      requisitionId: current.id,
      changes: { title: "Título atualizado" },
    });

    expect(output.title).toBe("Título atualizado");
    expect(output.description).toBe("Descrição original");
    expect(output.priority).toBe("LOW");
    expect(output.estimatedHours).toBe(4);
    expect(current.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("altera title, description, priority, referências, estimativa e datas", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await dependencies.membershipRepository.create(
      Membership.create({ companyId: COMPANY_ID, userId: RESPONSIBLE_ID, position: "GESTOR" }),
    );
    await seedSystem(dependencies.systemRepository);
    await seedVersion(dependencies.systemVersionRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);
    const startDate = new Date("2026-09-01T00:00:00Z");
    const plannedDeliveryDate = new Date("2026-09-05T00:00:00Z");
    const deliveredAt = new Date("2026-09-05T15:00:00Z");

    await dependencies.useCase.execute({
      actor,
      requisitionId: current.id,
      changes: {
        title: "Novo título",
        description: "Nova descrição",
        priority: "HIGH",
        responsibleId: RESPONSIBLE_ID,
        systemId: SYSTEM_ID,
        systemVersionId: VERSION_ID,
        estimatedHours: 12,
        startDate,
        plannedDeliveryDate,
        deliveredAt,
      },
    });

    expect(current.title).toBe("Novo título");
    expect(current.description).toBe("Nova descrição");
    expect(current.priority).toBe("HIGH");
    expect(current.responsibleId).toBe(RESPONSIBLE_ID);
    expect(current.systemId).toBe(SYSTEM_ID);
    expect(current.systemVersionId).toBe(VERSION_ID);
    expect(current.estimatedHours).toBe(12);
    expect(current.startDate).toBe(startDate);
    expect(current.plannedDeliveryDate).toBe(plannedDeliveryDate);
    expect(current.deliveredAt).toBe(deliveredAt);
  });

  it("remove description, referências, estimativa e datas quando recebe null", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await dependencies.membershipRepository.create(
      Membership.create({ companyId: COMPANY_ID, userId: RESPONSIBLE_ID, position: "GESTOR" }),
    );
    await seedSystem(dependencies.systemRepository);
    await seedVersion(dependencies.systemVersionRepository);
    const current = requisition({
      responsibleId: RESPONSIBLE_ID,
      systemId: SYSTEM_ID,
      systemVersionId: VERSION_ID,
      deliveredAt: new Date("2026-08-14T00:00:00Z"),
    });
    dependencies.requisitionRepository.seed(current);

    await dependencies.useCase.execute({
      actor,
      requisitionId: current.id,
      changes: {
        description: null,
        responsibleId: null,
        systemId: null,
        systemVersionId: null,
        estimatedHours: null,
        startDate: null,
        plannedDeliveryDate: null,
        deliveredAt: null,
      },
    });

    expect(current.description).toBeNull();
    expect(current.responsibleId).toBeNull();
    expect(current.systemId).toBeNull();
    expect(current.systemVersionId).toBeNull();
    expect(current.estimatedHours).toBeNull();
    expect(current.startDate).toBeNull();
    expect(current.plannedDeliveryDate).toBeNull();
    expect(current.deliveredAt).toBeNull();
  });

  it("não remove systemVersionId automaticamente ao remover systemId", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await seedVersion(dependencies.systemVersionRepository);
    const current = requisition({ systemId: SYSTEM_ID, systemVersionId: VERSION_ID });
    dependencies.requisitionRepository.seed(current);

    await dependencies.useCase.execute({
      actor,
      requisitionId: current.id,
      changes: { systemId: null },
    });

    expect(current.systemId).toBeNull();
    expect(current.systemVersionId).toBe(VERSION_ID);
  });

  it("mantém campos imutáveis e status intactos", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition({ status: "IN_PROGRESS" });
    dependencies.requisitionRepository.seed(current);
    const original = {
      companyId: current.companyId,
      number: current.number,
      requesterId: current.requesterId,
      createdAt: current.createdAt,
      status: current.status,
    };

    await dependencies.useCase.execute({
      actor,
      requisitionId: current.id,
      changes: { title: "Alterado" },
    });

    expect(current.companyId).toBe(original.companyId);
    expect(current.number).toBe(original.number);
    expect(current.requesterId).toBe(original.requesterId);
    expect(current.createdAt).toBe(original.createdAt);
    expect(current.status).toBe(original.status);
  });

  it("lança ValidationError para payload vazio ou campo imutável", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: current.id, changes: {} }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      dependencies.useCase.execute({
        actor,
        requisitionId: current.id,
        changes: { status: "DONE" } as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lança ForbiddenError sem permissão ou com membership inativa", async () => {
    const dependencies = build();
    const current = requisition();
    dependencies.requisitionRepository.seed(current);
    await dependencies.membershipRepository.create(
      Membership.create({ companyId: COMPANY_ID, userId: ACTOR_ID, position: "SUPORTE" }),
    );

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: [] },
        requisitionId: current.id,
        changes: { title: "Sem permissão" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const membership = await dependencies.membershipRepository.findByUserAndCompany(
      ACTOR_ID,
      COMPANY_ID,
    );
    membership?.deactivate();
    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: ["requisitions.update"] },
        requisitionId: current.id,
        changes: { title: "Membership inativa" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança NotFoundError para requisição inexistente ou de outro tenant", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    await expect(
      dependencies.useCase.execute({
        actor,
        requisitionId: "missing",
        changes: { title: "Ausente" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const foreign = requisition({ id: "foreign", companyId: OTHER_COMPANY_ID });
    dependencies.requisitionRepository.seed(foreign);
    await expect(
      dependencies.useCase.execute({
        actor,
        requisitionId: foreign.id,
        changes: { title: "Outro tenant" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each([
    ["responsibleId", { responsibleId: RESPONSIBLE_ID }],
    ["systemId", { systemId: SYSTEM_ID }],
    ["systemVersionId", { systemVersionId: VERSION_ID }],
  ])("lança NotFoundError para %s inválido", async (_field, changes) => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await expect(
      dependencies.useCase.execute({
        actor,
        requisitionId: current.id,
        changes: { title: "Referência inválida", ...changes },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança NotFoundError para referências de outro tenant", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await dependencies.membershipRepository.create(
      Membership.create({
        companyId: OTHER_COMPANY_ID,
        userId: RESPONSIBLE_ID,
        position: "GESTOR",
      }),
    );
    await seedSystem(dependencies.systemRepository, OTHER_COMPANY_ID);
    await seedVersion(dependencies.systemVersionRepository, OTHER_SYSTEM_ID, OTHER_COMPANY_ID);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await expect(
      dependencies.useCase.execute({
        actor,
        requisitionId: current.id,
        changes: { responsibleId: RESPONSIBLE_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      dependencies.useCase.execute({
        actor,
        requisitionId: current.id,
        changes: { systemId: SYSTEM_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      dependencies.useCase.execute({
        actor,
        requisitionId: current.id,
        changes: { systemVersionId: VERSION_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança NotFoundError para sistema e versão incompatíveis", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await seedSystem(dependencies.systemRepository);
    await seedVersion(dependencies.systemVersionRepository, OTHER_SYSTEM_ID);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await expect(
      dependencies.useCase.execute({
        actor,
        requisitionId: current.id,
        changes: { systemId: SYSTEM_ID, systemVersionId: VERSION_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("persiste e retorna a entidade atualizada", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    const output = await dependencies.useCase.execute({
      actor,
      requisitionId: current.id,
      changes: { title: "Persistida" },
    });

    expect(dependencies.requisitionRepository.updated).toBe(current);
    expect(output.id).toBe(current.id);
    expect(output.title).toBe("Persistida");
  });
});
