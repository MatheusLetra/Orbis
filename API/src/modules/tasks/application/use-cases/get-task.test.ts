import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { GetTask } from "@/modules/tasks/application/use-cases/get-task";
import { Task } from "@/modules/tasks/domain/entities/task";
import { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import { ForbiddenError, NotFoundError } from "@/shared/errors/typed-errors";
import {
  InMemoryTaskRepository,
  InMemoryTaskStatusHistoryRepository,
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

function actor(permissions: "all" | "none" = "all") {
  return {
    userId: ACTOR_ID,
    companyId: COMPANY_ID,
    permissions: permissions === "all" ? ["tasks.read"] : [],
  } as const;
}

function task(companyId = COMPANY_ID) {
  const createdAt = new Date("2026-08-12T10:00:00Z");
  return Task.restore({
    id: TASK_ID,
    companyId,
    requisitionId: null,
    title: "Tarefa",
    description: "Descrição",
    priority: "HIGH",
    status: "TODO",
    assigneeId: null,
    startDate: new Date("2026-08-12T00:00:00Z"),
    plannedEndDate: new Date("2026-08-20T00:00:00Z"),
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}

function buildSut() {
  const memberships = new FakeMembershipRepository();
  const tasks = new InMemoryTaskRepository();
  const history = new InMemoryTaskStatusHistoryRepository();
  const useCase = new GetTask(
    tasks,
    history,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );
  return { memberships, tasks, history, useCase };
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

describe("GetTask", () => {
  it("retorna Task com histórico completo e datas ISO", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.tasks.create(task());
    const initialAt = new Date("2026-08-12T10:00:00Z");
    const transitionAt = new Date("2026-08-12T12:00:00Z");
    await sut.history.create(
      TaskStatusHistory.createInitial({
        taskId: TASK_ID,
        changedBy: ACTOR_ID,
        changedAt: initialAt,
      }),
    );
    await sut.history.create(
      TaskStatusHistory.createTransition({
        taskId: TASK_ID,
        fromStatus: "TODO",
        toStatus: "IN_PROGRESS",
        changedBy: ACTOR_ID,
        changedAt: transitionAt,
        metadata: { source: "test" },
      }),
    );

    const output = await sut.useCase.execute({ actor: actor(), taskId: TASK_ID });

    expect(output).toMatchObject({
      id: TASK_ID,
      companyId: COMPANY_ID,
      startDate: "2026-08-12T00:00:00.000Z",
      plannedEndDate: "2026-08-20T00:00:00.000Z",
    });
    expect(output.history).toHaveLength(2);
    expect(output.history[0]).toMatchObject({
      fromStatus: null,
      toStatus: "TODO",
      changedAt: initialAt.toISOString(),
      metadata: null,
    });
    expect(output.history[1]).toMatchObject({
      fromStatus: "TODO",
      toStatus: "IN_PROGRESS",
      changedAt: transitionAt.toISOString(),
      metadata: { source: "test" },
    });
  });

  it("retorna histórico vazio e preserva a ordem recebida", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.tasks.create(task());

    await expect(sut.useCase.execute({ actor: actor(), taskId: TASK_ID })).resolves.toMatchObject({
      history: [],
    });
  });

  it("exige tasks.read e membership ativa", async () => {
    const forbidden = buildSut();
    await seedActor(forbidden.memberships);
    await forbidden.tasks.create(task());
    await expect(
      forbidden.useCase.execute({ actor: actor("none"), taskId: TASK_ID }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const inactive = buildSut();
    await seedActor(inactive.memberships, false);
    await inactive.tasks.create(task());
    await expect(
      inactive.useCase.execute({ actor: actor(), taskId: TASK_ID }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejeita Task inexistente ou de outro tenant e não consulta histórico", async () => {
    const missing = buildSut();
    await seedActor(missing.memberships);
    let historyCalls = 0;
    const listHistory = missing.history.listByTask;
    missing.history.listByTask = async (...args) => {
      historyCalls += 1;
      return listHistory.apply(missing.history, args);
    };
    await expect(
      missing.useCase.execute({ actor: actor(), taskId: TASK_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(historyCalls).toBe(0);

    const foreign = buildSut();
    await seedActor(foreign.memberships);
    await foreign.tasks.create(task(OTHER_COMPANY_ID));
    await expect(
      foreign.useCase.execute({ actor: actor(), taskId: TASK_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("não altera Task nem histórico", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    const persistedTask = task();
    await sut.tasks.create(persistedTask);
    const history = TaskStatusHistory.createInitial({ taskId: TASK_ID, changedBy: ACTOR_ID });
    await sut.history.create(history);

    await sut.useCase.execute({ actor: actor(), taskId: TASK_ID });

    expect(await sut.tasks.findById(COMPANY_ID, TASK_ID)).toBe(persistedTask);
    expect(sut.history.items[0]).toBe(history);
  });
});
