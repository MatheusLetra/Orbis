import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import { CreateTask } from "@/modules/tasks/application/use-cases/create-task";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";
import { InMemoryTaskUnitOfWork } from "@/test/fakes/task-fakes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNEE_ID = "44444444-4444-4444-8444-444444444444";
const REQUISITION_ID = "55555555-5555-4555-8555-555555555555";

class FakeMembershipRepository {
  memberships = new Map<string, Membership>();

  async create(membership: Membership): Promise<Membership> {
    this.memberships.set(`${membership.companyId}:${membership.userId}`, membership);
    return membership;
  }

  async findByUserAndCompany(userId: string, companyId: string): Promise<Membership | null> {
    return this.memberships.get(`${companyId}:${userId}`) ?? null;
  }

  async findById(): Promise<Membership | null> {
    return null;
  }

  async listByUser(): Promise<Membership[]> {
    return [];
  }

  async listByCompany(): Promise<Membership[]> {
    return [];
  }

  async update(membership: Membership): Promise<Membership> {
    return this.create(membership);
  }
}

class FakeRequisitionRepository {
  requisitions = new Map<string, Requisition>();

  async create(requisition: Requisition): Promise<Requisition> {
    this.requisitions.set(requisition.id, requisition);
    return requisition;
  }

  async findById(id: string): Promise<Requisition | null> {
    return this.requisitions.get(id) ?? null;
  }

  async update(requisition: Requisition): Promise<Requisition> {
    return this.create(requisition);
  }

  async delete(): Promise<void> {}

  async listByCompany(): Promise<Requisition[]> {
    return [];
  }
}

function actor(permissions: "all" | "manage" | "none" = "all") {
  return {
    userId: ACTOR_ID,
    companyId: COMPANY_ID,
    permissions:
      permissions === "all"
        ? ["tasks.create", "kanban.manage"]
        : permissions === "manage"
          ? ["kanban.manage"]
          : [],
  } as const;
}

function ownActor() {
  return { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: ["tasks.create"] } as const;
}

function buildSut() {
  const memberships = new FakeMembershipRepository();
  const requisitions = new FakeRequisitionRepository();
  const unitOfWork = new InMemoryTaskUnitOfWork();
  const useCase = new CreateTask(
    unitOfWork,
    memberships,
    requisitions,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );

  return { memberships, requisitions, unitOfWork, useCase };
}

async function seedActor(memberships: FakeMembershipRepository, active = true) {
  const membership = Membership.create({
    companyId: COMPANY_ID,
    userId: ACTOR_ID,
    position: "DESENVOLVEDOR",
  });
  if (!active) membership.deactivate();
  await memberships.create(membership);
}

describe("CreateTask", () => {
  it("cria com dados mínimos e persiste histórico inicial atomicamente", async () => {
    const { memberships, useCase } = buildSut();
    await seedActor(memberships);

    const output = await useCase.execute({ actor: actor(), data: { title: "Nova tarefa" } });

    expect(output.status).toBe("TODO");
    expect(output.priority).toBe("MEDIUM");
    expect(output.completedAt).toBeNull();
  });

  it("usa companyId e changedBy do actor", async () => {
    const { memberships, unitOfWork, useCase } = buildSut();
    await seedActor(memberships);

    const output = await useCase.execute({ actor: actor(), data: { title: "Tarefa" } });
    const history = unitOfWork.historyRepository.items[0];

    expect(output.companyId).toBe(COMPANY_ID);
    expect(history?.changedBy).toBe(ACTOR_ID);
  });

  it("cria com todos os opcionais e serializa datas", async () => {
    const { memberships, requisitions, useCase } = buildSut();
    await seedActor(memberships);
    await memberships.create(
      Membership.create({
        companyId: COMPANY_ID,
        userId: ASSIGNEE_ID,
        position: "DESENVOLVEDOR",
      }),
    );
    await requisitions.create(
      Requisition.create(
        { companyId: COMPANY_ID, number: 1, title: "Req", requesterId: ACTOR_ID },
        REQUISITION_ID,
      ),
    );
    const startDate = new Date("2026-08-12T00:00:00Z");
    const plannedEndDate = new Date("2026-08-13T00:00:00Z");

    const output = await useCase.execute({
      actor: actor(),
      data: {
        title: "  Tarefa completa  ",
        description: "  Descrição  ",
        priority: "HIGH",
        assigneeId: ASSIGNEE_ID,
        requisitionId: REQUISITION_ID,
        startDate,
        plannedEndDate,
      },
    });

    expect(output).toMatchObject({
      companyId: COMPANY_ID,
      requisitionId: REQUISITION_ID,
      title: "Tarefa completa",
      description: "Descrição",
      priority: "HIGH",
      assigneeId: ASSIGNEE_ID,
      status: "TODO",
      completedAt: null,
      startDate: startDate.toISOString(),
      plannedEndDate: plannedEndDate.toISOString(),
    });
  });

  it("usa task.createdAt como changedAt e metadata null", async () => {
    const { memberships, unitOfWork, useCase } = buildSut();
    await seedActor(memberships);

    const output = await useCase.execute({ actor: actor(), data: { title: "Tarefa" } });
    const history = unitOfWork.historyRepository.items[0];

    expect(history?.fromStatus).toBeNull();
    expect(history?.toStatus).toBe("TODO");
    expect(history?.taskId).toBe(output.id);
    expect(history?.changedAt.toISOString()).toBe(output.createdAt);
    expect(history?.metadata).toBeNull();
  });

  it("rejeita assignee inexistente, inativo ou de outro tenant", async () => {
    const missing = buildSut();
    await seedActor(missing.memberships);
    await expect(
      missing.useCase.execute({
        actor: actor(),
        data: { title: "Tarefa", assigneeId: ASSIGNEE_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const inactive = buildSut();
    await seedActor(inactive.memberships);
    const inactiveMembership = Membership.create({
      companyId: COMPANY_ID,
      userId: ASSIGNEE_ID,
      position: "DESENVOLVEDOR",
    });
    inactiveMembership.deactivate();
    await inactive.memberships.create(inactiveMembership);
    await expect(
      inactive.useCase.execute({
        actor: actor(),
        data: { title: "Tarefa", assigneeId: ASSIGNEE_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const foreign = buildSut();
    await seedActor(foreign.memberships);
    await foreign.memberships.create(
      Membership.create({
        companyId: OTHER_COMPANY_ID,
        userId: ASSIGNEE_ID,
        position: "DESENVOLVEDOR",
      }),
    );
    await expect(
      foreign.useCase.execute({
        actor: actor(),
        data: { title: "Tarefa", assigneeId: ASSIGNEE_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita requisição inexistente ou de outro tenant", async () => {
    const { memberships, requisitions, useCase } = buildSut();
    await seedActor(memberships);
    await requisitions.create(
      Requisition.create(
        { companyId: OTHER_COMPANY_ID, number: 1, title: "Req", requesterId: ACTOR_ID },
        REQUISITION_ID,
      ),
    );

    await expect(
      useCase.execute({ actor: actor(), data: { title: "Tarefa", requisitionId: REQUISITION_ID } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita ausência de permissão e membership inativa do ator", async () => {
    const first = buildSut();
    await seedActor(first.memberships);
    await expect(
      first.useCase.execute({ actor: actor("none"), data: { title: "Tarefa" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const second = buildSut();
    await seedActor(second.memberships, false);
    await expect(
      second.useCase.execute({ actor: actor(), data: { title: "Tarefa" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("permite criar sem responsável ou para si com tasks.create", async () => {
    const { memberships, useCase } = buildSut();
    await seedActor(memberships);

    await expect(
      useCase.execute({ actor: ownActor(), data: { title: "Sem responsável" } }),
    ).resolves.toMatchObject({ assigneeId: null });
    await expect(
      useCase.execute({
        actor: ownActor(),
        data: { title: "Própria", assigneeId: ACTOR_ID },
      }),
    ).resolves.toMatchObject({ assigneeId: ACTOR_ID });
  });

  it("exige kanban.manage para criar para terceiro", async () => {
    const { memberships, unitOfWork, useCase } = buildSut();
    await seedActor(memberships);
    await memberships.create(
      Membership.create({
        companyId: COMPANY_ID,
        userId: ASSIGNEE_ID,
        position: "DESENVOLVEDOR",
      }),
    );

    await expect(
      useCase.execute({
        actor: ownActor(),
        data: { title: "De terceiro", assigneeId: ASSIGNEE_ID },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(unitOfWork.executeCalls).toBe(0);

    await expect(
      useCase.execute({
        actor: actor(),
        data: { title: "De terceiro", assigneeId: ASSIGNEE_ID },
      }),
    ).resolves.toMatchObject({ assigneeId: ASSIGNEE_ID });
  });

  it("não permite que kanban.manage substitua tasks.create", async () => {
    const { memberships, unitOfWork, useCase } = buildSut();
    await seedActor(memberships);

    await expect(
      useCase.execute({ actor: actor("manage"), data: { title: "Tarefa" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(unitOfWork.executeCalls).toBe(0);
  });

  it("rejeita payload inválido sem iniciar transação", async () => {
    const { memberships, unitOfWork, useCase } = buildSut();
    await seedActor(memberships);

    await expect(
      useCase.execute({ actor: actor(), data: { title: "   " } }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(unitOfWork.executeCalls).toBe(0);
  });

  it("persiste Task e histórico dentro da mesma Unit of Work", async () => {
    const { memberships, unitOfWork, useCase } = buildSut();
    await seedActor(memberships);

    await useCase.execute({ actor: actor(), data: { title: "Tarefa" } });

    expect(unitOfWork.executeCalls).toBe(1);
    expect(unitOfWork.taskRepository.createCalls).toBe(1);
    expect(unitOfWork.historyRepository.createCalls).toBe(1);
  });

  it("propaga falha do histórico e faz rollback no fake transacional", async () => {
    const { memberships, unitOfWork, useCase } = buildSut();
    await seedActor(memberships);
    unitOfWork.historyRepository.failOnCreate = true;

    await expect(useCase.execute({ actor: actor(), data: { title: "Tarefa" } })).rejects.toThrow(
      "Falha ao persistir histórico",
    );
    expect(unitOfWork.taskRepository.items).toHaveLength(0);
  });

  it("não aceita campos controlados pelo domínio", async () => {
    const { memberships, useCase } = buildSut();
    await seedActor(memberships);

    await expect(
      useCase.execute({
        actor: actor(),
        data: { title: "Tarefa", status: "DONE" } as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
