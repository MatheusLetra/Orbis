import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { RemoveRequisitionAssignee } from "@/modules/requisitions/application/use-cases/remove-requisition-assignee";
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
  deleteCalls = 0;
  receivedDelete: { companyId: string; requisitionId: string; userId: string } | null = null;

  seed(assignee: RequisitionAssignee): void {
    this.items.set(this.key(assignee.companyId, assignee.requisitionId, assignee.userId), assignee);
  }

  async findByRequisitionAndUser(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee | null> {
    return this.items.get(this.key(companyId, requisitionId, userId)) ?? null;
  }

  async create(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee> {
    const assignee = {
      companyId,
      requisitionId,
      userId,
      createdAt: new Date("2026-08-12T10:00:00Z"),
    };
    this.seed(assignee);
    return assignee;
  }

  async delete(companyId: string, requisitionId: string, userId: string): Promise<void> {
    this.deleteCalls += 1;
    this.receivedDelete = { companyId, requisitionId, userId };
    this.items.delete(this.key(companyId, requisitionId, userId));
  }

  private key(companyId: string, requisitionId: string, userId: string): string {
    return `${companyId}:${requisitionId}:${userId}`;
  }
}

function build() {
  const requisitionRepository = new InMemoryRequisitionRepository();
  const requisitionAssigneeRepository = new InMemoryRequisitionAssigneeRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const useCase = new RemoveRequisitionAssignee(
    requisitionRepository,
    requisitionAssigneeRepository,
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

function requisition(companyId = COMPANY_ID, responsibleId: string | null = null): Requisition {
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
    responsibleId,
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

function assignee(companyId = COMPANY_ID): RequisitionAssignee {
  return {
    companyId,
    requisitionId: "requisition-1",
    userId: MEMBER_ID,
    createdAt: new Date("2026-08-12T10:00:00Z"),
  };
}

describe("RemoveRequisitionAssignee", () => {
  it("remove vínculo existente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());
    await dependencies.requisitionAssigneeRepository.create(COMPANY_ID, "requisition-1", MEMBER_ID);

    await dependencies.useCase.execute({
      actor,
      requisitionId: "requisition-1",
      userId: MEMBER_ID,
    });

    await expect(
      dependencies.requisitionAssigneeRepository.findByRequisitionAndUser(
        COMPANY_ID,
        "requisition-1",
        MEMBER_ID,
      ),
    ).resolves.toBeNull();
  });

  it("retorna requisitionId e userId", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "requisition-1", userId: MEMBER_ID }),
    ).resolves.toEqual({ requisitionId: "requisition-1", userId: MEMBER_ID });
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
    expect(dependencies.requisitionAssigneeRepository.deleteCalls).toBe(0);
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
    expect(dependencies.requisitionAssigneeRepository.deleteCalls).toBe(0);
  });

  it("gera NotFoundError para requisição inexistente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "missing", userId: MEMBER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.requisitionAssigneeRepository.deleteCalls).toBe(0);
  });

  it("gera NotFoundError para requisição de outro tenant", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition(OTHER_COMPANY_ID));

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "requisition-1", userId: MEMBER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.requisitionAssigneeRepository.deleteCalls).toBe(0);
  });

  it("retorna sucesso para vínculo inexistente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "requisition-1", userId: MEMBER_ID }),
    ).resolves.toEqual({ requisitionId: "requisition-1", userId: MEMBER_ID });
  });

  it("não chama delete para vínculo inexistente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());

    await dependencies.useCase.execute({
      actor,
      requisitionId: "requisition-1",
      userId: MEMBER_ID,
    });

    expect(dependencies.requisitionAssigneeRepository.deleteCalls).toBe(0);
  });

  it("chama delete com companyId correto para vínculo existente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());
    dependencies.requisitionAssigneeRepository.seed(assignee());

    await dependencies.useCase.execute({
      actor,
      requisitionId: "requisition-1",
      userId: MEMBER_ID,
    });

    expect(dependencies.requisitionAssigneeRepository.receivedDelete).toEqual({
      companyId: COMPANY_ID,
      requisitionId: "requisition-1",
      userId: MEMBER_ID,
    });
  });

  it("não altera responsibleId", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition(COMPANY_ID, MEMBER_ID);
    dependencies.requisitionRepository.seed(current);
    dependencies.requisitionAssigneeRepository.seed(assignee());

    await dependencies.useCase.execute({ actor, requisitionId: current.id, userId: MEMBER_ID });

    expect(current.responsibleId).toBe(MEMBER_ID);
  });

  it("não remove vínculo quando validação anterior falha", async () => {
    const dependencies = build();
    const current = requisition();
    dependencies.requisitionRepository.seed(current);
    dependencies.requisitionAssigneeRepository.seed(assignee());

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: [] },
        requisitionId: current.id,
        userId: MEMBER_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(dependencies.requisitionAssigneeRepository.deleteCalls).toBe(0);
  });
});
