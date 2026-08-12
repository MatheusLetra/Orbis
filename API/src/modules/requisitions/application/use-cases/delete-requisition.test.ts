import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { DeleteRequisition } from "@/modules/requisitions/application/use-cases/delete-requisition";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, NotFoundError } from "@/shared/errors/typed-errors";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";

const ACTOR_ID = "actor-1";
const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";

class InMemoryRequisitionRepository implements RequisitionRepository {
  private readonly items = new Map<string, Requisition>();
  receivedFindId: string | null = null;
  receivedDeleteId: string | null = null;
  deleteCalls = 0;

  seed(requisition: Requisition): void {
    this.items.set(requisition.id, requisition);
  }

  async create(requisition: Requisition): Promise<Requisition> {
    this.items.set(requisition.id, requisition);
    return requisition;
  }

  async findById(id: string): Promise<Requisition | null> {
    this.receivedFindId = id;
    return this.items.get(id) ?? null;
  }

  async update(requisition: Requisition): Promise<Requisition> {
    this.items.set(requisition.id, requisition);
    return requisition;
  }

  async delete(id: string): Promise<void> {
    this.receivedDeleteId = id;
    this.deleteCalls += 1;
    this.items.delete(id);
  }

  async listByCompany(): Promise<Requisition[]> {
    return [];
  }
}

function build() {
  const requisitionRepository = new InMemoryRequisitionRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const useCase = new DeleteRequisition(requisitionRepository, accessService, authorization);

  return { useCase, requisitionRepository, membershipRepository };
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
    permissions: ["requisitions.delete"],
  };
}

function requisition(companyId = COMPANY_ID, id = "requisition-1"): Requisition {
  const now = new Date("2026-08-11T10:00:00Z");

  return Requisition.restore({
    id,
    companyId,
    number: 7,
    title: "Requisição de teste",
    description: null,
    priority: "MEDIUM",
    status: "OPEN",
    requesterId: "requester-1",
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

describe("DeleteRequisition", () => {
  it("exclui uma requisição válida", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await dependencies.useCase.execute({ actor, requisitionId: current.id });

    await expect(dependencies.requisitionRepository.findById(current.id)).resolves.toBeNull();
  });

  it("retorna { id }", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: current.id }),
    ).resolves.toEqual({ id: current.id });
  });

  it("exige requisitions.delete", async () => {
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
    expect(dependencies.requisitionRepository.deleteCalls).toBe(0);
  });

  it("membership inativa gera ForbiddenError", async () => {
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
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: ["requisitions.delete"] },
        requisitionId: "requisition-1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(dependencies.requisitionRepository.deleteCalls).toBe(0);
  });

  it("requisição inexistente gera NotFoundError", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: "missing" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.requisitionRepository.deleteCalls).toBe(0);
  });

  it("requisição de outro tenant gera NotFoundError", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const foreign = requisition(OTHER_COMPANY_ID);
    dependencies.requisitionRepository.seed(foreign);

    await expect(
      dependencies.useCase.execute({ actor, requisitionId: foreign.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(dependencies.requisitionRepository.deleteCalls).toBe(0);
  });

  it("não aceita companyId do cliente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await dependencies.useCase.execute({
      actor,
      requisitionId: current.id,
      companyId: OTHER_COMPANY_ID,
    } as never);

    expect(dependencies.requisitionRepository.receivedFindId).toBe(current.id);
    expect(dependencies.requisitionRepository.receivedDeleteId).toBe(current.id);
  });

  it("repository.delete recebe o ID correto", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await dependencies.useCase.execute({ actor, requisitionId: current.id });

    expect(dependencies.requisitionRepository.receivedDeleteId).toBe(current.id);
  });

  it("não chama repository.delete quando qualquer validação anterior falha", async () => {
    const dependencies = build();
    const current = requisition();
    dependencies.requisitionRepository.seed(current);

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: [] },
        requisitionId: current.id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const membership = Membership.create({
      companyId: COMPANY_ID,
      userId: ACTOR_ID,
      position: "GESTOR",
    });
    membership.deactivate();
    await dependencies.membershipRepository.create(membership);

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: ["requisitions.delete"] },
        requisitionId: current.id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(dependencies.requisitionRepository.deleteCalls).toBe(0);
  });
});
