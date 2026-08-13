import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import {
  companies,
  memberships,
  taskPauseIntervals,
  users,
} from "@/infrastructure/database/schema";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { DrizzleRequisitionRepository } from "@/modules/requisitions/infrastructure/repositories/drizzle-requisition-repository";
import { TransitionTaskStatus } from "@/modules/tasks/application/use-cases/transition-task-status";
import { UpdateTask } from "@/modules/tasks/application/use-cases/update-task";
import { Task } from "@/modules/tasks/domain/entities/task";
import { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-repository";
import { DrizzleTaskStatusHistoryRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-status-history-repository";
import { DrizzleTaskUnitOfWork } from "@/modules/tasks/infrastructure/unit-of-work/drizzle-task-unit-of-work";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/shared/errors/typed-errors";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_USER_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_MEMBERSHIP_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_COMPANY_ID = "77777777-7777-4777-8777-777777777777";
const OTHER_TASK_ID = "88888888-8888-4888-8888-888888888888";

describe.skipIf(!available)("concorrência entre UpdateTask e TransitionTaskStatus", () => {
  let db: Database;
  let taskRepository: DrizzleTaskRepository;
  let historyRepository: DrizzleTaskStatusHistoryRepository;
  let taskUnitOfWork: DrizzleTaskUnitOfWork;
  let updateTask: UpdateTask;
  let transitionTaskStatus: TransitionTaskStatus;

  beforeAll(async () => {
    db = await createTestDatabase();
    const membershipRepository = new DrizzleMembershipRepository(db);
    const requisitionRepository = new DrizzleRequisitionRepository(db);
    const accessService = new MembershipAccessService(membershipRepository);
    const authorization = new AuthorizationService();
    taskRepository = new DrizzleTaskRepository(db);
    historyRepository = new DrizzleTaskStatusHistoryRepository(db);
    taskUnitOfWork = new DrizzleTaskUnitOfWork(db);
    updateTask = new UpdateTask(
      taskUnitOfWork,
      membershipRepository,
      requisitionRepository,
      accessService,
      authorization,
    );
    transitionTaskStatus = new TransitionTaskStatus(taskUnitOfWork, accessService, authorization);
  });

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE task_status_history, tasks, memberships, companies, users CASCADE;`,
    );
    await db.insert(companies).values({ id: COMPANY_ID, name: "Tenant", timezone: "UTC" });
    await db.insert(users).values({
      id: USER_ID,
      email: "actor@example.com",
      name: "Actor",
      passwordHash: "hash",
    });
    await db.insert(users).values({
      id: OTHER_USER_ID,
      email: "other@example.com",
      name: "Other",
      passwordHash: "hash",
    });
    await db.insert(memberships).values({
      id: MEMBERSHIP_ID,
      companyId: COMPANY_ID,
      userId: USER_ID,
      position: "DESENVOLVEDOR",
      permissions: ["tasks.update"],
    });
    await db.insert(memberships).values({
      id: OTHER_MEMBERSHIP_ID,
      companyId: COMPANY_ID,
      userId: OTHER_USER_ID,
      position: "DESENVOLVEDOR",
      permissions: ["tasks.update"],
    });

    const createdAt = new Date("2026-08-12T10:00:00Z");
    const inProgressAt = new Date("2026-08-12T10:01:00Z");
    await taskRepository.create(
      Task.restore({
        id: TASK_ID,
        companyId: COMPANY_ID,
        requisitionId: null,
        title: "Título original",
        description: "Descrição original",
        priority: "LOW",
        status: "IN_PROGRESS",
        assigneeId: USER_ID,
        startDate: null,
        plannedEndDate: null,
        completedAt: null,
        createdAt,
        updatedAt: inProgressAt,
      }),
    );
    await historyRepository.create(
      TaskStatusHistory.createInitial({
        taskId: TASK_ID,
        changedBy: USER_ID,
        changedAt: createdAt,
      }),
    );
    await historyRepository.create(
      TaskStatusHistory.createTransition({
        taskId: TASK_ID,
        fromStatus: "TODO",
        toStatus: "IN_PROGRESS",
        changedBy: USER_ID,
        changedAt: inProgressAt,
      }),
    );
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("serializa edição e transição sem regravar status ou completedAt stale", async () => {
    const actor = {
      userId: USER_ID,
      companyId: COMPANY_ID,
      permissions: ["tasks.update"],
    } as const;
    let releaseLock!: () => void;
    const lockHeld = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const blocker = db.transaction(async (transaction) => {
      const repository = new DrizzleTaskRepository(transaction);
      await repository.findByIdForUpdate(COMPANY_ID, TASK_ID);
      await lockHeld;
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    const transition = transitionTaskStatus.execute({
      actor,
      taskId: TASK_ID,
      status: "DONE",
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    const update = updateTask
      .execute({
        actor,
        taskId: TASK_ID,
        changes: { title: "Título editado concorrentemente" },
      })
      .then(
        () => new Error("A edição de uma Task concluída deveria ser rejeitada"),
        (error: unknown) => error,
      );

    releaseLock();
    const [, , updateError] = await Promise.all([blocker, transition, update]);

    const finalTask = await taskRepository.findById(COMPANY_ID, TASK_ID);
    const history = await historyRepository.listByTask(COMPANY_ID, TASK_ID);

    expect(finalTask).toMatchObject({
      title: "Título original",
      status: "DONE",
    });
    expect(updateError).toBeInstanceOf(BusinessRuleError);
    expect(finalTask?.completedAt).not.toBeNull();
    expect(history.map((entry) => [entry.fromStatus, entry.toStatus])).toEqual([
      [null, "TODO"],
      ["TODO", "IN_PROGRESS"],
      ["IN_PROGRESS", "DONE"],
    ]);
    expect(history[2]?.changedAt).toEqual(finalTask?.completedAt);
    expect(history[2]?.changedAt).toEqual(finalTask?.updatedAt);
  });

  it("aplica own/global usando o assignee carregado sob lock", async () => {
    const ownActor = {
      userId: USER_ID,
      companyId: COMPANY_ID,
      permissions: ["tasks.update"],
    } as const;
    const task = await taskRepository.findById(COMPANY_ID, TASK_ID);
    if (!task) throw new Error("Task não criada");
    task.changeAssignee(OTHER_USER_ID);
    await taskRepository.update(task);

    await expect(
      transitionTaskStatus.execute({ actor: ownActor, taskId: TASK_ID, status: "DONE" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await historyRepository.listByTask(COMPANY_ID, TASK_ID)).toHaveLength(2);

    await expect(
      transitionTaskStatus.execute({
        actor: { ...ownActor, permissions: ["tasks.update", "kanban.manage"] },
        taskId: TASK_ID,
        status: "DONE",
      }),
    ).resolves.toMatchObject({ status: "DONE", completedAt: expect.any(String) });
    expect(await historyRepository.listByTask(COMPANY_ID, TASK_ID)).toHaveLength(3);
  });

  it("autoriza edição own-only pelo assignee confirmado após reatribuição sob lock", async () => {
    const ownActor = {
      userId: USER_ID,
      companyId: COMPANY_ID,
      permissions: ["tasks.update"],
    } as const;
    let reassignmentLocked!: () => void;
    let releaseReassignment!: () => void;
    const lockAcquired = new Promise<void>((resolve) => {
      reassignmentLocked = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseReassignment = resolve;
    });

    const reassignment = db.transaction(async (transaction) => {
      const repository = new DrizzleTaskRepository(transaction);
      const task = await repository.findByIdForUpdate(COMPANY_ID, TASK_ID);
      if (!task) throw new Error("Task não criada");
      task.changeAssignee(OTHER_USER_ID);
      await repository.update(task);
      reassignmentLocked();
      await release;
    });
    await lockAcquired;

    const ownEdit = updateTask.execute({
      actor: ownActor,
      taskId: TASK_ID,
      changes: { title: "Não pode sobrescrever" },
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseReassignment();

    await reassignment;
    await expect(ownEdit).rejects.toBeInstanceOf(ForbiddenError);
    expect(await taskRepository.findById(COMPANY_ID, TASK_ID)).toMatchObject({
      title: "Título original",
      assigneeId: OTHER_USER_ID,
    });
  });

  it("não persiste parcialmente uma reatribuição proibida", async () => {
    await expect(
      updateTask.execute({
        actor: {
          userId: USER_ID,
          companyId: COMPANY_ID,
          permissions: ["tasks.update"],
        },
        taskId: TASK_ID,
        changes: { title: "Não persistir", assigneeId: OTHER_USER_ID },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await taskRepository.findById(COMPANY_ID, TASK_ID)).toMatchObject({
      title: "Título original",
      assigneeId: USER_ID,
    });
  });

  it("mantém 404 e isolamento tenant mesmo com alcance global", async () => {
    await db.insert(companies).values({ id: OTHER_COMPANY_ID, name: "Outro", timezone: "UTC" });
    await taskRepository.create(
      Task.restore({
        id: OTHER_TASK_ID,
        companyId: OTHER_COMPANY_ID,
        requisitionId: null,
        title: "Task estrangeira",
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
      updateTask.execute({
        actor: {
          userId: USER_ID,
          companyId: COMPANY_ID,
          permissions: ["tasks.update", "kanban.manage"],
        },
        taskId: OTHER_TASK_ID,
        changes: { title: "Não alterar" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await taskRepository.findById(OTHER_COMPANY_ID, OTHER_TASK_ID)).toMatchObject({
      title: "Task estrangeira",
    });
  });

  it("mantém matriz de transição e rollback no PostgreSQL real", async () => {
    const actor = {
      userId: USER_ID,
      companyId: COMPANY_ID,
      permissions: ["tasks.update"],
    } as const;

    await expect(
      transitionTaskStatus.execute({ actor, taskId: TASK_ID, status: "TODO" }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(await taskRepository.findById(COMPANY_ID, TASK_ID)).toMatchObject({
      status: "IN_PROGRESS",
      completedAt: null,
    });
    expect(await historyRepository.listByTask(COMPANY_ID, TASK_ID)).toHaveLength(2);
  });

  it("serializa duas pausas concorrentes sem criar intervalos duplicados", async () => {
    const actor = {
      userId: USER_ID,
      companyId: COMPANY_ID,
      permissions: ["tasks.update"],
    } as const;

    const results = await Promise.allSettled([
      transitionTaskStatus.execute({ actor, taskId: TASK_ID, status: "PAUSED" }),
      transitionTaskStatus.execute({ actor, taskId: TASK_ID, status: "PAUSED" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: expect.any(BusinessRuleError) });
    expect(await taskRepository.findById(COMPANY_ID, TASK_ID)).toMatchObject({ status: "PAUSED" });
    expect(await db.select().from(taskPauseIntervals)).toHaveLength(1);
    expect(await historyRepository.listByTask(COMPANY_ID, TASK_ID)).toHaveLength(3);
  });
});
