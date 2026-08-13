import { describe, expect, it } from "vitest";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { ListTimeEntries } from "@/modules/tasks/application/use-cases/list-time-entries";
import { Task } from "@/modules/tasks/domain/entities/task";
import { TimeEntry } from "@/modules/tasks/domain/entities/time-entry";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";
import { InMemoryTaskRepository, InMemoryTimeEntryRepository } from "@/test/fakes/task-fakes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";

class Memberships {
  private readonly items = new Map<string, Membership>();
  add(membership: Membership) {
    this.items.set(`${membership.companyId}:${membership.userId}`, membership);
  }
  async findByUserAndCompany(userId: string, companyId: string) {
    return this.items.get(`${companyId}:${userId}`) ?? null;
  }
}

function buildTask(status: "TODO" | "IN_PROGRESS" | "PAUSED" | "DONE" = "TODO") {
  return Task.restore({
    id: TASK_ID,
    companyId: COMPANY_ID,
    requisitionId: null,
    title: "Task",
    description: null,
    priority: "MEDIUM",
    status,
    assigneeId: ACTOR_ID,
    startDate: null,
    plannedEndDate: null,
    completedAt: status === "DONE" ? new Date("2026-08-13T11:00:00Z") : null,
    createdAt: new Date("2026-08-13T10:00:00Z"),
    updatedAt: new Date("2026-08-13T10:00:00Z"),
  });
}

function buildEntry(id: string, durationMinutes: number, createdAt: string) {
  return TimeEntry.create(
    {
      companyId: COMPANY_ID,
      taskId: TASK_ID,
      userId: ACTOR_ID,
      durationMinutes,
      createdAt: new Date(createdAt),
    },
    id,
  );
}

async function buildSut(permissions: readonly string[] = ["tasks.read"]) {
  const memberships = new Memberships();
  memberships.add(
    Membership.create({ companyId: COMPANY_ID, userId: ACTOR_ID, position: "DESENVOLVEDOR" }),
  );
  const tasks = new InMemoryTaskRepository();
  const entries = new InMemoryTimeEntryRepository();
  await tasks.create(buildTask());
  const useCase = new ListTimeEntries(
    tasks,
    entries,
    new MembershipAccessService(memberships as never),
    new AuthorizationService(),
  );
  return {
    useCase,
    tasks,
    entries,
    memberships,
    actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions } as never,
  };
}

describe("ListTimeEntries", () => {
  it("lista ordenado, totaliza tudo e informa hasMore", async () => {
    const sut = await buildSut();
    await sut.entries.create(
      buildEntry("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 30, "2026-08-13T10:00:00Z"),
    );
    await sut.entries.create(
      buildEntry("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", 45, "2026-08-13T11:00:00Z"),
    );
    await sut.entries.create(
      buildEntry("cccccccc-cccc-4ccc-8ccc-cccccccccccc", 60, "2026-08-13T12:00:00Z"),
    );

    const output = await sut.useCase.execute({
      actor: sut.actor,
      taskId: TASK_ID,
      filters: { limit: 2 },
    });

    expect(output.items.map((entry) => entry.durationMinutes)).toEqual([30, 45]);
    expect(output.totalDurationMinutes).toBe(135);
    expect(output.hasMore).toBe(true);
    expect(sut.entries.listCalls).toBe(1);
    expect(sut.entries.sumCalls).toBe(1);
  });

  it.each(["TODO", "IN_PROGRESS", "PAUSED", "DONE"] as const)("lê Task %s", async (status) => {
    const sut = await buildSut();
    sut.tasks.items.set(TASK_ID, buildTask(status));
    await expect(sut.useCase.execute({ actor: sut.actor, taskId: TASK_ID })).resolves.toMatchObject(
      {
        items: [],
        totalDurationMinutes: 0,
        hasMore: false,
      },
    );
  });

  it("exige tasks.read, membership e Task existente", async () => {
    const denied = await buildSut([]);
    await expect(
      denied.useCase.execute({ actor: denied.actor, taskId: TASK_ID }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const inactive = await buildSut();
    const membership = await inactive.memberships.findByUserAndCompany(ACTOR_ID, COMPANY_ID);
    membership?.deactivate();
    await expect(
      inactive.useCase.execute({ actor: inactive.actor, taskId: TASK_ID }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const missing = await buildSut();
    await expect(
      missing.useCase.execute({
        actor: missing.actor,
        taskId: "44444444-4444-4444-8444-444444444444",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita limite inválido e não exige hours.register", async () => {
    const sut = await buildSut(["tasks.read"]);
    await expect(
      sut.useCase.execute({ actor: sut.actor, taskId: TASK_ID, filters: { limit: 0 } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      sut.useCase.execute({ actor: sut.actor, taskId: TASK_ID, filters: { limit: 101 } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
