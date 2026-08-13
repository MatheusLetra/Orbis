import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import {
  companies,
  memberships,
  requisitions,
  taskPauseIntervals,
  timeEntries,
  users,
} from "@/infrastructure/database/schema";
import { Task } from "@/modules/tasks/domain/entities/task";
import { TaskPauseInterval } from "@/modules/tasks/domain/entities/task-pause-interval";
import { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import { TimeEntry } from "@/modules/tasks/domain/entities/time-entry";
import { DrizzleTaskPauseIntervalRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-pause-interval-repository";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-repository";
import { DrizzleTaskStatusHistoryRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-status-history-repository";
import { DrizzleTimeEntryRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-time-entry-repository";
import { DrizzleTaskUnitOfWork } from "@/modules/tasks/infrastructure/unit-of-work/drizzle-task-unit-of-work";
import { BusinessRuleError } from "@/shared/errors/typed-errors";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "33333333-3333-4333-8333-333333333333";
const USER_B = "44444444-4444-4444-8444-444444444444";
const TASK_A = "55555555-5555-4555-8555-555555555555";
const TASK_B = "66666666-6666-4666-8666-666666666666";

function buildTask(
  id = TASK_A,
  companyId = COMPANY_A,
  overrides: Partial<Parameters<typeof Task.restore>[0]> = {},
): Task {
  const createdAt = overrides.createdAt ?? new Date("2026-08-12T10:00:00Z");

  return Task.restore({
    id,
    companyId,
    requisitionId: null,
    title: "Tarefa de teste",
    description: "Descrição",
    priority: "HIGH",
    status: "TODO",
    assigneeId: null,
    startDate: new Date("2026-08-13T00:00:00Z"),
    plannedEndDate: new Date("2026-08-20T00:00:00Z"),
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

describe.skipIf(!available)("persistência de Tasks e histórico", () => {
  let db: Database;
  let taskRepository: DrizzleTaskRepository;
  let historyRepository: DrizzleTaskStatusHistoryRepository;
  let pauseIntervalRepository: DrizzleTaskPauseIntervalRepository;
  let timeEntryRepository: DrizzleTimeEntryRepository;
  let unitOfWork: DrizzleTaskUnitOfWork;

  beforeAll(async () => {
    db = await createTestDatabase();
    taskRepository = new DrizzleTaskRepository(db);
    historyRepository = new DrizzleTaskStatusHistoryRepository(db);
    pauseIntervalRepository = new DrizzleTaskPauseIntervalRepository(db);
    timeEntryRepository = new DrizzleTimeEntryRepository(db);
    unitOfWork = new DrizzleTaskUnitOfWork(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE task_status_history, tasks, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC" },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC" },
    ]);
    await db.insert(users).values([
      { id: USER_A, email: "user-a@example.com", name: "User A", passwordHash: "hash" },
      { id: USER_B, email: "user-b@example.com", name: "User B", passwordHash: "hash" },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("cria e recupera Task com nulls, datas e enums", async () => {
    const created = await taskRepository.create(buildTask());
    const found = await taskRepository.findById(COMPANY_A, created.id);

    expect(found).toMatchObject({
      id: TASK_A,
      companyId: COMPANY_A,
      priority: "HIGH",
      status: "TODO",
      requisitionId: null,
      assigneeId: null,
      description: "Descrição",
    });
    expect(found?.startDate).toBeInstanceOf(Date);
    expect(found?.plannedEndDate).toBeInstanceOf(Date);
  });

  it("retorna null para Task inexistente e isola o tenant", async () => {
    await taskRepository.create(buildTask());

    await expect(taskRepository.findById(COMPANY_B, TASK_A)).resolves.toBeNull();
    await expect(taskRepository.findById(COMPANY_A, TASK_B)).resolves.toBeNull();
  });

  it("atualiza Task e retorna a entidade atualizada", async () => {
    const task = await taskRepository.create(buildTask());
    task.rename("Tarefa atualizada");

    const updated = await taskRepository.update(task);

    expect(updated.title).toBe("Tarefa atualizada");
    expect((await taskRepository.findById(COMPANY_A, TASK_A))?.title).toBe("Tarefa atualizada");
  });

  it("lista somente Tasks da empresa e aplica filtros documentados", async () => {
    await taskRepository.create(buildTask(TASK_A, COMPANY_A, { priority: "HIGH" }));
    await taskRepository.create(buildTask(TASK_B, COMPANY_B, { priority: "LOW" }));

    const result = await taskRepository.listByCompany(COMPANY_A, { priority: "HIGH" });

    expect(result.map((item) => item.task.id)).toEqual([TASK_A]);
  });

  it("pesquisa literalmente, aplica joins tenant-aware e preserva a ordenação", async () => {
    const requisitionId = "77777777-7777-4777-8777-777777777777";
    const membershipId = "88888888-8888-4888-8888-888888888888";
    await db.insert(memberships).values({
      id: membershipId,
      companyId: COMPANY_A,
      userId: USER_A,
      position: "DESENVOLVEDOR",
      permissions: [],
    });
    await db.insert(requisitions).values({
      id: requisitionId,
      companyId: COMPANY_A,
      number: 1,
      title: "Requisição Kanban",
      requesterId: USER_A,
    });
    await taskRepository.create(
      buildTask(TASK_A, COMPANY_A, {
        title: "100%_literal",
        assigneeId: USER_A,
        requisitionId,
        createdAt: new Date("2026-08-12T10:00:00Z"),
      }),
    );
    await taskRepository.create(
      buildTask(TASK_B, COMPANY_A, {
        title: "100Xliteral",
        createdAt: new Date("2026-08-12T11:00:00Z"),
      }),
    );

    const result = await taskRepository.listByCompany(COMPANY_A, { search: "100%_LITERAL" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      task: { id: TASK_A, title: "100%_literal" },
      assignee: { id: USER_A, name: "User A" },
      requisition: { id: requisitionId, number: 1, title: "Requisição Kanban" },
    });
  });

  it("cria e lista histórico por Task com ordenação determinística", async () => {
    await taskRepository.create(buildTask());
    const firstAt = new Date("2026-08-12T10:00:00Z");
    const secondAt = new Date("2026-08-12T11:00:00Z");

    await historyRepository.create(
      TaskStatusHistory.createInitial({ taskId: TASK_A, changedBy: USER_A, changedAt: firstAt }),
    );
    const task = await taskRepository.findById(COMPANY_A, TASK_A);
    task?.transitionTo("IN_PROGRESS", secondAt);
    await historyRepository.create(
      TaskStatusHistory.createTransition({
        taskId: TASK_A,
        fromStatus: "TODO",
        toStatus: "IN_PROGRESS",
        changedBy: USER_A,
        changedAt: secondAt,
      }),
    );

    const result = await historyRepository.listByTask(COMPANY_A, TASK_A);

    expect(result.map((history) => history.toStatus)).toEqual(["TODO", "IN_PROGRESS"]);
    expect(result.map((history) => history.changedAt)).toEqual([firstAt, secondAt]);
  });

  it("não expõe update ou delete no repository de histórico", () => {
    expect("update" in historyRepository).toBe(false);
    expect("delete" in historyRepository).toBe(false);
  });

  it("cria, busca e fecha um intervalo de pausa", async () => {
    await taskRepository.create(buildTask());
    const startedAt = new Date("2026-08-12T10:00:00.250Z");
    const endedAt = new Date("2026-08-12T10:01:01.999Z");
    const interval = await pauseIntervalRepository.create(
      TaskPauseInterval.createOpen({ taskId: TASK_A, startedAt }),
    );

    const open = await db.transaction((transaction) =>
      new DrizzleTaskPauseIntervalRepository(transaction).findOpenByTaskForUpdate(TASK_A),
    );
    expect(open).toMatchObject({ taskId: TASK_A, startedAt, endedAt: null });

    interval.close(endedAt);
    await pauseIntervalRepository.close(interval);

    await expect(
      db.transaction((transaction) =>
        new DrizzleTaskPauseIntervalRepository(transaction).findOpenByTaskForUpdate(TASK_A),
      ),
    ).resolves.toBeNull();
    const rows = await db.select().from(taskPauseIntervals);
    expect(rows).toEqual([
      expect.objectContaining({ endedAt, durationSeconds: 61, taskId: TASK_A }),
    ]);
  });

  it("detecta múltiplos intervalos abertos preexistentes", async () => {
    await taskRepository.create(buildTask());
    await pauseIntervalRepository.create(
      TaskPauseInterval.createOpen({ taskId: TASK_A, startedAt: new Date("2026-08-12T10:00:00Z") }),
    );
    await pauseIntervalRepository.create(
      TaskPauseInterval.createOpen({ taskId: TASK_A, startedAt: new Date("2026-08-12T11:00:00Z") }),
    );

    await expect(
      db.transaction((transaction) =>
        new DrizzleTaskPauseIntervalRepository(transaction).findOpenByTaskForUpdate(TASK_A),
      ),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("persiste TimeEntry manual com vínculo tenant-aware", async () => {
    await taskRepository.create(
      buildTask(TASK_A, COMPANY_A, { status: "DONE", completedAt: new Date() }),
    );
    const entry = await timeEntryRepository.create(
      TimeEntry.create({
        companyId: COMPANY_A,
        taskId: TASK_A,
        userId: USER_A,
        durationMinutes: 90,
        description: "Trabalho",
        createdAt: new Date("2026-08-13T12:00:00Z"),
      }),
    );

    expect(entry).toMatchObject({
      companyId: COMPANY_A,
      taskId: TASK_A,
      userId: USER_A,
      durationMinutes: 90,
      description: "Trabalho",
      startedAt: null,
      endedAt: null,
    });
    expect(await db.select().from(timeEntries).where(eq(timeEntries.id, entry.id))).toHaveLength(1);
  });

  it("lista TimeEntries ordenado, limita e soma todas as entradas por tenant", async () => {
    await taskRepository.create(buildTask());
    await taskRepository.create(buildTask(TASK_B, COMPANY_B));
    const entries = [
      TimeEntry.create({
        companyId: COMPANY_A,
        taskId: TASK_A,
        userId: USER_A,
        durationMinutes: 30,
        createdAt: new Date("2026-08-13T10:00:00Z"),
      }),
      TimeEntry.create({
        companyId: COMPANY_A,
        taskId: TASK_A,
        userId: USER_A,
        durationMinutes: 45,
        createdAt: new Date("2026-08-13T11:00:00Z"),
      }),
      TimeEntry.create({
        companyId: COMPANY_B,
        taskId: TASK_B,
        userId: USER_B,
        durationMinutes: 90,
        createdAt: new Date("2026-08-13T09:00:00Z"),
      }),
    ];
    for (const entry of entries) await timeEntryRepository.create(entry);

    const listed = await timeEntryRepository.listByTask(COMPANY_A, TASK_A, 2);
    expect(listed.map((entry) => entry.durationMinutes)).toEqual([30, 45]);
    expect(await timeEntryRepository.sumDurationByTask(COMPANY_A, TASK_A)).toBe(75);
    expect(await timeEntryRepository.sumDurationByTask(COMPANY_B, TASK_B)).toBe(90);
  });

  it("isola histórico pelo tenant da Task pai", async () => {
    await taskRepository.create(buildTask(TASK_A, COMPANY_A));
    await historyRepository.create(
      TaskStatusHistory.createInitial({ taskId: TASK_A, changedBy: USER_A }),
    );

    await expect(historyRepository.listByTask(COMPANY_B, TASK_A)).resolves.toEqual([]);
    await expect(historyRepository.listByTask(COMPANY_A, TASK_A)).resolves.toHaveLength(1);
  });

  it("compartilha repositories transacionais e confirma no sucesso", async () => {
    await unitOfWork.execute(async ({ tasks: tasksInTransaction, taskStatusHistory }) => {
      await tasksInTransaction.create(buildTask());
      await taskStatusHistory.create(
        TaskStatusHistory.createInitial({ taskId: TASK_A, changedBy: USER_A }),
      );
    });

    expect(await taskRepository.findById(COMPANY_A, TASK_A)).not.toBeNull();
    expect(await historyRepository.listByTask(COMPANY_A, TASK_A)).toHaveLength(1);
  });

  it("faz rollback de Task e histórico quando o callback falha", async () => {
    await expect(
      unitOfWork.execute(async ({ tasks: tasksInTransaction, taskStatusHistory }) => {
        await tasksInTransaction.create(buildTask());
        await taskStatusHistory.create(
          TaskStatusHistory.createInitial({ taskId: TASK_A, changedBy: USER_A }),
        );
        throw new Error("falha transacional");
      }),
    ).rejects.toThrow("falha transacional");

    expect(await taskRepository.findById(COMPANY_A, TASK_A)).toBeNull();
  });

  it("faz rollback da atualização e histórico juntos", async () => {
    await taskRepository.create(buildTask());

    await expect(
      unitOfWork.execute(async ({ tasks: tasksInTransaction, taskStatusHistory }) => {
        const task = await tasksInTransaction.findByIdForUpdate(COMPANY_A, TASK_A);
        if (!task) throw new Error("Task não encontrada");
        task.transitionTo("IN_PROGRESS", new Date("2026-08-12T12:00:00Z"));
        await tasksInTransaction.update(task);
        await taskStatusHistory.create(
          TaskStatusHistory.createTransition({
            taskId: TASK_A,
            fromStatus: "TODO",
            toStatus: "IN_PROGRESS",
            changedBy: USER_A,
          }),
        );
        throw new Error("falha após transição");
      }),
    ).rejects.toThrow("falha após transição");

    expect((await taskRepository.findById(COMPANY_A, TASK_A))?.status).toBe("TODO");
    expect(await historyRepository.listByTask(COMPANY_A, TASK_A)).toEqual([]);
  });

  it("faz rollback de Task, pausa e histórico juntos", async () => {
    await taskRepository.create(buildTask(TASK_A, COMPANY_A, { status: "IN_PROGRESS" }));

    await expect(
      unitOfWork.execute(async ({ tasks, taskStatusHistory, taskPauseIntervals }) => {
        const task = await tasks.findByIdForUpdate(COMPANY_A, TASK_A);
        if (!task) throw new Error("Task não encontrada");
        const occurredAt = new Date("2026-08-12T12:00:00Z");
        task.transitionTo("PAUSED", occurredAt);
        await tasks.update(task);
        await taskPauseIntervals.create(
          TaskPauseInterval.createOpen({ taskId: TASK_A, startedAt: occurredAt }),
        );
        await taskStatusHistory.create(
          TaskStatusHistory.createTransition({
            taskId: TASK_A,
            fromStatus: "IN_PROGRESS",
            toStatus: "PAUSED",
            changedBy: USER_A,
            changedAt: occurredAt,
          }),
        );
        throw new Error("falha após pausa");
      }),
    ).rejects.toThrow("falha após pausa");

    expect(await taskRepository.findById(COMPANY_A, TASK_A)).toMatchObject({
      status: "IN_PROGRESS",
    });
    expect(await db.select().from(taskPauseIntervals)).toEqual([]);
    expect(await historyRepository.listByTask(COMPANY_A, TASK_A)).toEqual([]);
  });

  it("serializa locks concorrentes com findByIdForUpdate", async () => {
    await taskRepository.create(buildTask());
    let releaseFirst!: () => void;
    const firstLocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let secondFinished = false;

    const first = db.transaction(async (transaction) => {
      const repository = new DrizzleTaskRepository(transaction);
      await repository.findByIdForUpdate(COMPANY_A, TASK_A);
      await firstLocked;
    });
    await new Promise((resolve) => setTimeout(resolve, 25));

    const second = db.transaction(async (transaction) => {
      const repository = new DrizzleTaskRepository(transaction);
      await repository.findByIdForUpdate(COMPANY_A, TASK_A);
      secondFinished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(secondFinished).toBe(false);
    releaseFirst();
    await Promise.all([first, second]);
    expect(secondFinished).toBe(true);
  });
});
