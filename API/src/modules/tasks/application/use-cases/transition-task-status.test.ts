import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { TransitionTaskStatus } from "@/modules/tasks/application/use-cases/transition-task-status";
import { Task } from "@/modules/tasks/domain/entities/task";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/typed-errors";
import {
  InMemoryTaskRepository,
  InMemoryTaskStatusHistoryRepository,
  InMemoryTaskUnitOfWork,
} from "@/test/fakes/task-fakes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const TASK_ID = "44444444-4444-4444-8444-444444444444";

class FakeMembershipRepository {
  private readonly memberships = new Map<string, Membership>();

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

function actor(permissions: readonly ("tasks.update" | "kanban.manage")[] = ["tasks.update"]) {
  return {
    userId: ACTOR_ID,
    companyId: COMPANY_ID,
    permissions,
  } as const;
}

function buildTask(
  status: Parameters<typeof Task.restore>[0]["status"] = "TODO",
  assigneeId: string | null = ACTOR_ID,
) {
  const createdAt = new Date("2026-08-12T10:00:00Z");
  return Task.restore({
    id: TASK_ID,
    companyId: COMPANY_ID,
    requisitionId: null,
    title: "Tarefa",
    description: null,
    priority: "MEDIUM",
    status,
    assigneeId,
    startDate: null,
    plannedEndDate: null,
    completedAt: status === "DONE" ? new Date("2026-08-12T09:00:00Z") : null,
    createdAt,
    updatedAt: createdAt,
  });
}

function buildSut() {
  const memberships = new FakeMembershipRepository();
  const taskRepository = new InMemoryTaskRepository();
  const historyRepository = new InMemoryTaskStatusHistoryRepository();
  const unitOfWork = new InMemoryTaskUnitOfWork(taskRepository, historyRepository);
  const useCase = new TransitionTaskStatus(
    unitOfWork,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );

  return { memberships, taskRepository, historyRepository, unitOfWork, useCase };
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

describe("TransitionTaskStatus", () => {
  it.each([
    ["TODO", "IN_PROGRESS"],
    ["IN_PROGRESS", "PAUSED"],
    ["PAUSED", "IN_PROGRESS"],
    ["IN_PROGRESS", "DONE"],
  ] as const)("permite %s → %s", async (fromStatus, toStatus) => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.taskRepository.create(buildTask(fromStatus));
    const transitionAt = new Date("2026-08-12T12:00:00Z");

    const output = await sut.useCase.execute({
      actor: actor(),
      taskId: TASK_ID,
      status: toStatus,
      occurredAt: transitionAt,
    });

    expect(output.status).toBe(toStatus);
    expect(sut.historyRepository.items).toHaveLength(1);
    expect(sut.historyRepository.items[0]).toMatchObject({
      fromStatus,
      toStatus,
      changedBy: ACTOR_ID,
      changedAt: transitionAt,
      metadata: null,
    });
  });

  it("usa o mesmo instante em updatedAt, changedAt e completedAt", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.taskRepository.create(buildTask("IN_PROGRESS"));
    const transitionAt = new Date("2026-08-12T12:00:00Z");

    const output = await sut.useCase.execute({
      actor: actor(),
      taskId: TASK_ID,
      status: "DONE",
      occurredAt: transitionAt,
    });

    expect(output.updatedAt).toBe(transitionAt.toISOString());
    expect(output.completedAt).toBe(transitionAt.toISOString());
    expect(sut.historyRepository.items[0]?.changedAt).toBe(transitionAt);
  });

  it("mantém completedAt nulo fora de DONE", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.taskRepository.create(buildTask("TODO"));

    const output = await sut.useCase.execute({
      actor: actor(),
      taskId: TASK_ID,
      status: "IN_PROGRESS",
    });

    expect(output.completedAt).toBeNull();
  });

  it.each([
    ["TODO", "PAUSED"],
    ["TODO", "DONE"],
    ["IN_PROGRESS", "TODO"],
    ["PAUSED", "TODO"],
    ["PAUSED", "DONE"],
    ["DONE", "TODO"],
    ["DONE", "IN_PROGRESS"],
    ["IN_PROGRESS", "IN_PROGRESS"],
  ] as const)("rejeita %s → %s sem persistência parcial", async (fromStatus, status) => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.taskRepository.create(buildTask(fromStatus));

    await expect(
      sut.useCase.execute({ actor: actor(), taskId: TASK_ID, status }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    expect(sut.taskRepository.updateCalls).toBe(0);
    expect(sut.historyRepository.items).toHaveLength(0);
  });

  it("rejeita status inválido sem iniciar transação", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);

    await expect(
      sut.useCase.execute({ actor: actor(), taskId: TASK_ID, status: "INVALID" as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(sut.unitOfWork.executeCalls).toBe(0);
  });

  it("rejeita Task inexistente ou de outro tenant", async () => {
    const missing = buildSut();
    await seedActor(missing.memberships);
    await expect(
      missing.useCase.execute({ actor: actor(), taskId: TASK_ID, status: "IN_PROGRESS" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const foreign = buildSut();
    await seedActor(foreign.memberships);
    await foreign.taskRepository.create(
      Task.restore({
        id: TASK_ID,
        companyId: OTHER_COMPANY_ID,
        requisitionId: null,
        title: "Tarefa",
        description: null,
        priority: "MEDIUM",
        status: "TODO",
        assigneeId: null,
        startDate: null,
        plannedEndDate: null,
        completedAt: null,
        createdAt: new Date("2026-08-12T10:00:00Z"),
        updatedAt: new Date("2026-08-12T10:00:00Z"),
      }),
    );
    await expect(
      foreign.useCase.execute({ actor: actor(), taskId: TASK_ID, status: "IN_PROGRESS" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("exige tasks.update e membership ativa do actor", async () => {
    const forbidden = buildSut();
    await seedActor(forbidden.memberships);
    await forbidden.taskRepository.create(buildTask());
    await expect(
      forbidden.useCase.execute({ actor: actor([]), taskId: TASK_ID, status: "IN_PROGRESS" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const inactive = buildSut();
    await seedActor(inactive.memberships, false);
    await inactive.taskRepository.create(buildTask());
    await expect(
      inactive.useCase.execute({ actor: actor(), taskId: TASK_ID, status: "IN_PROGRESS" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("permite alcance global somente com tasks.update e kanban.manage", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.taskRepository.create(buildTask("TODO", "55555555-5555-4555-8555-555555555555"));

    await expect(
      sut.useCase.execute({
        actor: actor(["tasks.update", "kanban.manage"]),
        taskId: TASK_ID,
        status: "IN_PROGRESS",
      }),
    ).resolves.toMatchObject({ status: "IN_PROGRESS" });
  });

  it.each([
    ["outro responsável", "55555555-5555-4555-8555-555555555555"],
    ["sem responsável", null],
  ])("nega own-only para Task %s após o load bloqueado", async (_case, assigneeId) => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.taskRepository.create(buildTask("TODO", assigneeId));

    await expect(
      sut.useCase.execute({ actor: actor(), taskId: TASK_ID, status: "IN_PROGRESS" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(sut.taskRepository.findByIdForUpdateCalls).toBe(1);
    expect(sut.taskRepository.updateCalls).toBe(0);
    expect(sut.historyRepository.items).toHaveLength(0);
  });

  it("não permite que kanban.manage substitua tasks.update", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.taskRepository.create(buildTask("TODO", null));

    await expect(
      sut.useCase.execute({
        actor: actor(["kanban.manage"]),
        taskId: TASK_ID,
        status: "IN_PROGRESS",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(sut.unitOfWork.executeCalls).toBe(0);
  });

  it("usa findByIdForUpdate e não findById", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.taskRepository.create(buildTask());

    await sut.useCase.execute({ actor: actor(), taskId: TASK_ID, status: "IN_PROGRESS" });

    expect(sut.taskRepository.findByIdCalls).toBe(0);
    expect(sut.taskRepository.findByIdForUpdateCalls).toBe(1);
  });

  it("faz rollback quando update ou history.create falha", async () => {
    const updateFailure = buildSut();
    await seedActor(updateFailure.memberships);
    await updateFailure.taskRepository.create(buildTask());
    updateFailure.taskRepository.update = async () => {
      throw new Error("Falha ao atualizar Task");
    };
    await expect(
      updateFailure.useCase.execute({ actor: actor(), taskId: TASK_ID, status: "IN_PROGRESS" }),
    ).rejects.toThrow("Falha ao atualizar Task");
    expect((await updateFailure.taskRepository.findById(COMPANY_ID, TASK_ID))?.status).toBe("TODO");
    expect(updateFailure.historyRepository.items).toHaveLength(0);

    const historyFailure = buildSut();
    await seedActor(historyFailure.memberships);
    await historyFailure.taskRepository.create(buildTask());
    historyFailure.historyRepository.failOnCreate = true;
    await expect(
      historyFailure.useCase.execute({ actor: actor(), taskId: TASK_ID, status: "IN_PROGRESS" }),
    ).rejects.toThrow("Falha ao persistir histórico");
    expect((await historyFailure.taskRepository.findById(COMPANY_ID, TASK_ID))?.status).toBe(
      "TODO",
    );
    expect(historyFailure.historyRepository.items).toHaveLength(0);
  });

  it("retorna output completo com datas ISO", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.taskRepository.create(buildTask());

    const output = await sut.useCase.execute({
      actor: actor(),
      taskId: TASK_ID,
      status: "IN_PROGRESS",
      occurredAt: new Date("2026-08-12T12:00:00Z"),
    });

    expect(output).toMatchObject({
      id: TASK_ID,
      companyId: COMPANY_ID,
      status: "IN_PROGRESS",
      createdAt: "2026-08-12T10:00:00.000Z",
      updatedAt: "2026-08-12T12:00:00.000Z",
    });
  });
});
