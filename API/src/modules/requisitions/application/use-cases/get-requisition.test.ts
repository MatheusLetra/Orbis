import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { GetRequisition } from "@/modules/requisitions/application/use-cases/get-requisition";
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
  receivedId: string | null = null;

  seed(requisition: Requisition): void {
    this.items.set(requisition.id, requisition);
  }

  async create(requisition: Requisition): Promise<Requisition> {
    this.items.set(requisition.id, requisition);
    return requisition;
  }

  async findById(id: string): Promise<Requisition | null> {
    this.receivedId = id;
    return this.items.get(id) ?? null;
  }

  async update(requisition: Requisition): Promise<Requisition> {
    this.items.set(requisition.id, requisition);
    return requisition;
  }

  async listByCompany(): Promise<Requisition[]> {
    return [];
  }
}

class InMemoryRequisitionAssigneeRepository implements RequisitionAssigneeRepository {
  assignees: RequisitionAssignee[] = [];
  receivedCompanyId: string | null = null;
  receivedRequisitionId: string | null = null;
  listCalls = 0;

  async findByRequisitionAndUser(): Promise<RequisitionAssignee | null> {
    return null;
  }

  async create(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee> {
    const assignee = { companyId, requisitionId, userId, createdAt: new Date() };
    this.assignees.push(assignee);
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
    return this.assignees.filter(
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
  const useCase = new GetRequisition(
    requisitionRepository,
    requisitionAssigneeRepository,
    accessService,
    authorization,
  );

  return { useCase, requisitionRepository, requisitionAssigneeRepository, membershipRepository };
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
    permissions: ["requisitions.read"],
  };
}

function requisition(companyId = COMPANY_ID, id = "requisition-1"): Requisition {
  const now = new Date("2026-08-11T10:00:00Z");

  return Requisition.restore({
    id,
    companyId,
    number: 7,
    title: "Requisição de teste",
    description: "Descrição de teste",
    priority: "HIGH",
    status: "OPEN",
    requesterId: "requester-1",
    responsibleId: null,
    systemId: null,
    systemVersionId: null,
    estimatedHours: 4,
    startDate: new Date("2026-08-12T00:00:00Z"),
    plannedDeliveryDate: null,
    deliveredAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

describe("GetRequisition", () => {
  it("retorna uma requisição existente da empresa do ator", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    const output = await dependencies.useCase.execute({ actor, requisitionId: current.id });

    expect(output.id).toBe(current.id);
    expect(output.companyId).toBe(COMPANY_ID);
    expect(output.assignees).toEqual([]);
  });

  it("retorna detalhe com requisição e equipe", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);
    dependencies.requisitionAssigneeRepository.assignees = [
      {
        companyId: COMPANY_ID,
        requisitionId: current.id,
        userId: "user-1",
        createdAt: new Date("2026-08-12T10:00:00Z"),
      },
    ];

    const output = await dependencies.useCase.execute({ actor, requisitionId: current.id });

    expect(output).toEqual({
      id: current.id,
      companyId: COMPANY_ID,
      number: 7,
      title: "Requisição de teste",
      description: "Descrição de teste",
      priority: "HIGH",
      status: "OPEN",
      requesterId: "requester-1",
      responsibleId: null,
      systemId: null,
      systemVersionId: null,
      estimatedHours: 4,
      startDate: "2026-08-12T00:00:00.000Z",
      plannedDeliveryDate: null,
      deliveredAt: null,
      createdAt: "2026-08-11T10:00:00.000Z",
      updatedAt: "2026-08-11T10:00:00.000Z",
      assignees: [{ userId: "user-1", createdAt: "2026-08-12T10:00:00.000Z" }],
    });
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

  it("rejeita membership inativa", async () => {
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
    const foreign = requisition(OTHER_COMPANY_ID);
    dependencies.requisitionRepository.seed(foreign);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: foreign.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.requisitionAssigneeRepository.listCalls).toBe(0);
  });

  it("não aceita companyId do cliente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    const output = await dependencies.useCase.execute({
      actor,
      requisitionId: current.id,
      companyId: OTHER_COMPANY_ID,
    } as never);

    expect(output.companyId).toBe(COMPANY_ID);
  });

  it("consulta assignees com companyId e requisitionId corretos", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await dependencies.useCase.execute({ actor, requisitionId: current.id });

    expect(dependencies.requisitionAssigneeRepository.receivedCompanyId).toBe(COMPANY_ID);
    expect(dependencies.requisitionAssigneeRepository.receivedRequisitionId).toBe(current.id);
  });

  it("preserva a ordem retornada pelo repository", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);
    dependencies.requisitionAssigneeRepository.assignees = [
      {
        companyId: COMPANY_ID,
        requisitionId: current.id,
        userId: "user-z",
        createdAt: new Date("2026-08-12T12:00:00Z"),
      },
      {
        companyId: COMPANY_ID,
        requisitionId: current.id,
        userId: "user-a",
        createdAt: new Date("2026-08-12T10:00:00Z"),
      },
    ];

    const output = await dependencies.useCase.execute({ actor, requisitionId: current.id });

    expect(output.assignees.map((assignee) => assignee.userId)).toEqual(["user-z", "user-a"]);
  });

  it("não altera responsibleId e não expõe companyId na equipe", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    current.changeResponsible("responsible-1");
    dependencies.requisitionRepository.seed(current);
    dependencies.requisitionAssigneeRepository.assignees = [
      {
        companyId: COMPANY_ID,
        requisitionId: current.id,
        userId: "user-1",
        createdAt: new Date("2026-08-12T10:00:00Z"),
      },
    ];

    const output = await dependencies.useCase.execute({ actor, requisitionId: current.id });

    expect(output.responsibleId).toBe("responsible-1");
    expect(output.assignees[0]).toEqual({
      userId: "user-1",
      createdAt: "2026-08-12T10:00:00.000Z",
    });
    expect(output.assignees[0]).not.toHaveProperty("companyId");
  });

  it("chama o repository com o requisitionId correto", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await dependencies.useCase.execute({ actor, requisitionId: current.id });

    expect(dependencies.requisitionRepository.receivedId).toBe(current.id);
  });

  it("não consulta assignees quando uma validação anterior falha", async () => {
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
