import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { AddRequisitionAssignee } from "@/modules/requisitions/application/use-cases/add-requisition-assignee";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionAssignee } from "@/modules/requisitions/domain/entities/requisition-assignee";
import type { RequisitionAssigneeRepository } from "@/modules/requisitions/domain/repositories/requisition-assignee-repository";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, NotFoundError } from "@/shared/errors/typed-errors";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";

const ACTOR_ID = "actor-1";
const MEMBER_ID = "member-1";
const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";

class InMemoryRequisitionRepository implements RequisitionRepository {
  private readonly items = new Map<string, Requisition>();

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
    return requisition;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async listByCompany(): Promise<Requisition[]> {
    return [];
  }
}

class InMemoryRequisitionAssigneeRepository implements RequisitionAssigneeRepository {
  private readonly items = new Map<string, RequisitionAssignee>();
  receivedCompanyIds: string[] = [];
  receivedRequisitionIds: string[] = [];
  receivedUserIds: string[] = [];
  createCalls = 0;

  async findByRequisitionAndUser(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee | null> {
    this.record(companyId, requisitionId, userId);
    return this.items.get(this.key(companyId, requisitionId, userId)) ?? null;
  }

  async create(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee> {
    this.record(companyId, requisitionId, userId);
    this.createCalls += 1;
    const assignee = {
      companyId,
      requisitionId,
      userId,
      createdAt: new Date("2026-08-12T10:00:00Z"),
    };
    this.items.set(this.key(companyId, requisitionId, userId), assignee);
    return assignee;
  }

  seed(assignee: RequisitionAssignee): void {
    this.items.set(this.key(assignee.companyId, assignee.requisitionId, assignee.userId), assignee);
  }

  private key(companyId: string, requisitionId: string, userId: string): string {
    return `${companyId}:${requisitionId}:${userId}`;
  }

  private record(companyId: string, requisitionId: string, userId: string): void {
    this.receivedCompanyIds.push(companyId);
    this.receivedRequisitionIds.push(requisitionId);
    this.receivedUserIds.push(userId);
  }
}

function build() {
  const requisitionRepository = new InMemoryRequisitionRepository();
  const requisitionAssigneeRepository = new InMemoryRequisitionAssigneeRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const useCase = new AddRequisitionAssignee(
    requisitionRepository,
    requisitionAssigneeRepository,
    membershipRepository,
    accessService,
    authorization,
  );

  return {
    useCase,
    requisitionRepository,
    requisitionAssigneeRepository,
    membershipRepository,
  };
}

async function activeActor(
  membershipRepository: InMemoryMembershipRepository,
  companyId = COMPANY_ID,
): Promise<AuthenticatedUser> {
  await membershipRepository.create(
    Membership.create({ companyId, userId: ACTOR_ID, position: "GESTOR" }),
  );

  return { userId: ACTOR_ID, companyId, permissions: ["requisitions.update"] };
}

function requisition(companyId = COMPANY_ID): Requisition {
  const now = new Date("2026-08-12T09:00:00Z");
  return Requisition.restore({
    id: "requisition-1",
    companyId,
    number: 1,
    title: "Requisição de teste",
    description: null,
    priority: "MEDIUM",
    status: "OPEN",
    requesterId: ACTOR_ID,
    responsibleId: null,
    systemId: null,
    systemVersionId: null,
    estimatedHours: null,
    startDate: null,
    plannedDeliveryDate: null,
    deliveredAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function activeMember(
  membershipRepository: InMemoryMembershipRepository,
  userId = MEMBER_ID,
  companyId = COMPANY_ID,
): Promise<void> {
  await membershipRepository.create(Membership.create({ companyId, userId, position: "SUPORTE" }));
}

describe("AddRequisitionAssignee", () => {
  it("adiciona membership ativa da mesma empresa", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await activeMember(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());

    const output = await dependencies.useCase.execute({
      actor,
      requisitionId: "requisition-1",
      userId: MEMBER_ID,
    });

    expect(output).toEqual({ userId: MEMBER_ID, createdAt: "2026-08-12T10:00:00.000Z" });
  });

  it("exige requisitions.update", async () => {
    const dependencies = build();
    await dependencies.membershipRepository.create(
      Membership.create({ companyId: COMPANY_ID, userId: ACTOR_ID, position: "GESTOR" }),
    );

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: [] },
        requisitionId: "requisition-1",
        userId: MEMBER_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejeita membership inativa do ator", async () => {
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
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: ["requisitions.update"] },
        requisitionId: "requisition-1",
        userId: MEMBER_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejeita requisição inexistente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await activeMember(dependencies.membershipRepository);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "missing", userId: MEMBER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita requisição de outro tenant", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await activeMember(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition(OTHER_COMPANY_ID));

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "requisition-1", userId: MEMBER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each([
    ["inexistente", undefined, COMPANY_ID],
    ["inativo", false, COMPANY_ID],
    ["de outro tenant", true, OTHER_COMPANY_ID],
  ])("rejeita membro %s", async (_label, isActive, companyId) => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());
    if (isActive !== undefined) {
      const membership = Membership.create({ companyId, userId: MEMBER_ID, position: "SUPORTE" });
      if (!isActive) membership.deactivate();
      await dependencies.membershipRepository.create(membership);
    }

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "requisition-1", userId: MEMBER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("permite que responsibleId também seja membro da equipe", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await activeMember(dependencies.membershipRepository, MEMBER_ID);
    const current = requisition();
    const withResponsible = Requisition.restore({
      ...({} as never),
      id: current.id,
      companyId: current.companyId,
      number: current.number,
      title: current.title,
      description: current.description,
      priority: current.priority,
      status: current.status,
      requesterId: current.requesterId,
      responsibleId: MEMBER_ID,
      systemId: current.systemId,
      systemVersionId: current.systemVersionId,
      estimatedHours: current.estimatedHours,
      startDate: current.startDate,
      plannedDeliveryDate: current.plannedDeliveryDate,
      deliveredAt: current.deliveredAt,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
    });
    dependencies.requisitionRepository.seed(withResponsible);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: withResponsible.id, userId: MEMBER_ID }),
    ).resolves.toMatchObject({ userId: MEMBER_ID });
  });

  it("retorna vínculo existente sem duplicar", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await activeMember(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());
    const existing = {
      companyId: COMPANY_ID,
      requisitionId: "requisition-1",
      userId: MEMBER_ID,
      createdAt: new Date("2026-08-10T10:00:00Z"),
    };
    dependencies.requisitionAssigneeRepository.seed(existing);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "requisition-1", userId: MEMBER_ID }),
    ).resolves.toEqual({ userId: MEMBER_ID, createdAt: "2026-08-10T10:00:00.000Z" });
    expect(dependencies.requisitionAssigneeRepository.createCalls).toBe(0);
  });

  it("envia companyId correto ao repository", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    await activeMember(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());

    await dependencies.useCase.execute({
      actor,
      requisitionId: "requisition-1",
      userId: MEMBER_ID,
    });

    expect(dependencies.requisitionAssigneeRepository.receivedCompanyIds).toEqual([
      COMPANY_ID,
      COMPANY_ID,
    ]);
    expect(dependencies.requisitionAssigneeRepository.receivedRequisitionIds).toEqual([
      "requisition-1",
      "requisition-1",
    ]);
    expect(dependencies.requisitionAssigneeRepository.receivedUserIds).toEqual([
      MEMBER_ID,
      MEMBER_ID,
    ]);
  });

  it("não cria vínculo quando uma validação anterior falha", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "missing", userId: MEMBER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.requisitionAssigneeRepository.createCalls).toBe(0);
  });
});
