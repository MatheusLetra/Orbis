import { describe, expect, it } from "vitest";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { RegisterTimeEntry } from "@/modules/tasks/application/use-cases/register-time-entry";
import { Task } from "@/modules/tasks/domain/entities/task";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";
import { InMemoryTaskUnitOfWork } from "@/test/fakes/task-fakes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_USER_ID = "44444444-4444-4444-8444-444444444444";
const TASK_ID = "55555555-5555-4555-8555-555555555555";

class Memberships {
  private readonly items = new Map<string, Membership>();
  async create(value: Membership) {
    this.items.set(`${value.companyId}:${value.userId}`, value);
  }
  async findByUserAndCompany(userId: string, companyId: string) {
    return this.items.get(`${companyId}:${userId}`) ?? null;
  }
}

function task(
  status: "TODO" | "IN_PROGRESS" | "PAUSED" | "DONE" = "TODO",
  assigneeId: string | null = ACTOR_ID,
  companyId = COMPANY_ID,
) {
  return Task.restore({
    id: TASK_ID,
    companyId,
    requisitionId: null,
    title: "Task",
    description: null,
    priority: "MEDIUM",
    status,
    assigneeId,
    startDate: null,
    plannedEndDate: null,
    completedAt: status === "DONE" ? new Date("2026-08-13T11:00:00Z") : null,
    createdAt: new Date("2026-08-13T10:00:00Z"),
    updatedAt: new Date("2026-08-13T10:00:00Z"),
  });
}

function actor(permissions: readonly string[] = ["hours.register"]) {
  return { userId: ACTOR_ID, companyId: COMPANY_ID, permissions } as never;
}

async function setup() {
  const memberships = new Memberships();
  await memberships.create(
    Membership.create({ companyId: COMPANY_ID, userId: ACTOR_ID, position: "DESENVOLVEDOR" }),
  );
  const uow = new InMemoryTaskUnitOfWork();
  await uow.taskRepository.create(task());
  const useCase = new RegisterTimeEntry(
    uow,
    new MembershipAccessService(memberships as never),
    new AuthorizationService(),
  );
  return { uow, memberships, useCase };
}

describe("RegisterTimeEntry", () => {
  it.each(["TODO", "IN_PROGRESS", "PAUSED", "DONE"] as const)(
    "registra em Task %s",
    async (status) => {
      const sut = await setup();
      sut.uow.taskRepository.items.set(TASK_ID, task(status));
      const output = await sut.useCase.execute({
        actor: actor(),
        taskId: TASK_ID,
        data: { durationMinutes: 90, description: "  X  " },
      });
      expect(output).toMatchObject({
        companyId: COMPANY_ID,
        taskId: TASK_ID,
        userId: ACTOR_ID,
        durationMinutes: 90,
        description: "X",
        startedAt: null,
        endedAt: null,
      });
      expect(sut.uow.taskRepository.items.get(TASK_ID)?.status).toBe(status);
    },
  );

  it("exige hours.register e permite alcance global somente com a permissão", async () => {
    const own = await setup();
    await expect(
      own.useCase.execute({ actor: actor([]), taskId: TASK_ID, data: { durationMinutes: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const global = await setup();
    global.uow.taskRepository.items.set(TASK_ID, task("TODO", OTHER_USER_ID));
    await expect(
      global.useCase.execute({
        actor: actor(["hours.register", "kanban.manage"]),
        taskId: TASK_ID,
        data: { durationMinutes: 1 },
      }),
    ).resolves.toMatchObject({ userId: ACTOR_ID });
    const denied = await setup();
    denied.uow.taskRepository.items.set(TASK_ID, task("TODO", OTHER_USER_ID));
    await expect(
      denied.useCase.execute({ actor: actor(), taskId: TASK_ID, data: { durationMinutes: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("nega Task sem assignee para own-only e valida membership", async () => {
    const own = await setup();
    own.uow.taskRepository.items.set(TASK_ID, task("TODO", null));
    await expect(
      own.useCase.execute({ actor: actor(), taskId: TASK_ID, data: { durationMinutes: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const inactive = await setup();
    const membership = await inactive.memberships.findByUserAndCompany(ACTOR_ID, COMPANY_ID);
    membership?.deactivate();
    await expect(
      inactive.useCase.execute({ actor: actor(), taskId: TASK_ID, data: { durationMinutes: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("mantém 404 tenant-aware e rollback", async () => {
    const missing = await setup();
    await expect(
      missing.useCase.execute({
        actor: actor(),
        taskId: "66666666-6666-4666-8666-666666666666",
        data: { durationMinutes: 1 },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const foreign = await setup();
    foreign.uow.taskRepository.items.set(TASK_ID, task("TODO", ACTOR_ID, OTHER_COMPANY_ID));
    await expect(
      foreign.useCase.execute({ actor: actor(), taskId: TASK_ID, data: { durationMinutes: 1 } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const invalid = await setup();
    await expect(
      invalid.useCase.execute({ actor: actor(), taskId: TASK_ID, data: { durationMinutes: 0 } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("faz rollback quando o repository falha", async () => {
    const sut = await setup();
    sut.uow.timeEntryRepository.failOnCreate = true;
    await expect(
      sut.useCase.execute({ actor: actor(), taskId: TASK_ID, data: { durationMinutes: 1 } }),
    ).rejects.toThrow("Falha ao persistir apontamento");
    expect(sut.uow.timeEntryRepository.items).toHaveLength(0);
  });
});
