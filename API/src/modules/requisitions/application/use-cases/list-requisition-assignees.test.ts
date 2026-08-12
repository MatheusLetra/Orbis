import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { ListRequisitionAssignees } from "@/modules/requisitions/application/use-cases/list-requisition-assignees";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionAssignee } from "@/modules/requisitions/domain/entities/requisition-assignee";
import type { RequisitionAssigneeRepository } from "@/modules/requisitions/domain/repositories/requisition-assignee-repository";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, NotFoundError } from "@/shared/errors/typed-errors";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";

const ACTOR_ID = "actor-1";
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
  private readonly items: RequisitionAssignee[] = [];
  receivedCompanyId: string | null = null;
  receivedRequisitionId: string | null = null;
  listCalls = 0;

  seed(assignee: RequisitionAssignee): void {
    this.items.push(assignee);
  }

  async findByRequisitionAndUser(): Promise<RequisitionAssignee | null> {
    return null;
  }

  async create(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee> {
    const assignee = { companyId, requisitionId, userId, createdAt: new Date() };
    this.items.push(assignee);
    return assignee;
  }

  async delete(): Promise<void> {}

  async listByRequisition(
    companyId: string,
    requisitionId: string,
  ): Promise<RequisitionAssignee[]> {
    this.receivedCompanyId = companyId;
    this.receivedRequisitionId = requisitionId;
    this.listCalls += 1;
    return this.items.filter(
      (assignee) => assignee.companyId === companyId && assignee.requisitionId === requisitionId,
    );
  }
}

function build() {
  const requisitionRepository = new InMemoryRequisitionRepository();
  const requisitionAssigneeRepository = new InMemoryRequisitionAssigneeRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const useCase = new ListRequisitionAssignees(
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

  return { userId: ACTOR_ID, companyId, permissions: ["requisitions.read"] };
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

function assignee(userId: string, createdAt: string, companyId = COMPANY_ID): RequisitionAssignee {
  return {
    companyId,
    requisitionId: "requisition-1",
    userId,
    createdAt: new Date(createdAt),
  };
}

describe("ListRequisitionAssignees", () => {
  it("lista membros de uma requisição válida", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());
    dependencies.requisitionAssigneeRepository.seed(assignee("user-1", "2026-08-12T10:00:00Z"));

    const output = await dependencies.useCase.execute({
      actor,
      requisitionId: "requisition-1",
    });

    expect(output).toEqual([{ userId: "user-1", createdAt: "2026-08-12T10:00:00.000Z" }]);
  });

  it("retorna [] quando não houver membros", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "requisition-1" }),
    ).resolves.toEqual([]);
  });

  it("exige requisitions.read", async () => {
    const dependencies = build();
    await dependencies.membershipRepository.create(
      Membership.create({ companyId: COMPANY_ID, userId: ACTOR_ID, position: "GESTOR" }),
    );

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: [] },
        requisitionId: "requisition-1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(dependencies.requisitionAssigneeRepository.listCalls).toBe(0);
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
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: ["requisitions.read"] },
        requisitionId: "requisition-1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(dependencies.requisitionAssigneeRepository.listCalls).toBe(0);
  });

  it("gera NotFoundError para requisição inexistente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "missing" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.requisitionAssigneeRepository.listCalls).toBe(0);
  });

  it("gera NotFoundError para requisição de outro tenant", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition(OTHER_COMPANY_ID));

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "requisition-1" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.requisitionAssigneeRepository.listCalls).toBe(0);
  });

  it("envia companyId correto ao repository", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());

    await dependencies.useCase.execute({ actor, requisitionId: "requisition-1" });

    expect(dependencies.requisitionAssigneeRepository.receivedCompanyId).toBe(COMPANY_ID);
  });

  it("envia requisitionId correto ao repository", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());

    await dependencies.useCase.execute({ actor, requisitionId: "requisition-1" });

    expect(dependencies.requisitionAssigneeRepository.receivedRequisitionId).toBe("requisition-1");
  });

  it("não expõe companyId e contém userId e createdAt", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());
    dependencies.requisitionAssigneeRepository.seed(assignee("user-1", "2026-08-12T10:00:00Z"));

    const [output] = await dependencies.useCase.execute({ actor, requisitionId: "requisition-1" });

    expect(output).toEqual({ userId: "user-1", createdAt: "2026-08-12T10:00:00.000Z" });
    expect(output).not.toHaveProperty("companyId");
  });

  it("ordena por createdAt ascendente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());
    dependencies.requisitionAssigneeRepository.seed(assignee("late", "2026-08-12T12:00:00Z"));
    dependencies.requisitionAssigneeRepository.seed(assignee("early", "2026-08-12T10:00:00Z"));

    const output = await dependencies.useCase.execute({ actor, requisitionId: "requisition-1" });

    expect(output.map((item) => item.userId)).toEqual(["early", "late"]);
  });

  it("usa userId como desempate de createdAt", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition());
    dependencies.requisitionAssigneeRepository.seed(assignee("user-z", "2026-08-12T10:00:00Z"));
    dependencies.requisitionAssigneeRepository.seed(assignee("user-a", "2026-08-12T10:00:00Z"));

    const output = await dependencies.useCase.execute({ actor, requisitionId: "requisition-1" });

    expect(output.map((item) => item.userId)).toEqual(["user-a", "user-z"]);
  });

  it("não consulta a lista quando uma validação anterior falha", async () => {
    const dependencies = build();

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: [] },
        requisitionId: "missing",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(dependencies.requisitionAssigneeRepository.listCalls).toBe(0);
  });
});
