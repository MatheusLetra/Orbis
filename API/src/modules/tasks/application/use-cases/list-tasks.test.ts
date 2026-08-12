import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { ListTasks } from "@/modules/tasks/application/use-cases/list-tasks";
import { Task } from "@/modules/tasks/domain/entities/task";
import { ForbiddenError, ValidationError } from "@/shared/errors/typed-errors";
import { InMemoryTaskRepository } from "@/test/fakes/task-fakes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNEE_ID = "44444444-4444-4444-8444-444444444444";
const REQUISITION_ID = "55555555-5555-4555-8555-555555555555";

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

function task(
  id: string,
  companyId: string,
  createdAt: string,
  overrides: Partial<Parameters<typeof Task.restore>[0]> = {},
) {
  const timestamp = new Date(createdAt);
  return Task.restore({
    id,
    companyId,
    requisitionId: null,
    title: `Task ${id}`,
    description: null,
    priority: "MEDIUM",
    status: "TODO",
    assigneeId: null,
    startDate: null,
    plannedEndDate: null,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  });
}

function buildSut() {
  const memberships = new FakeMembershipRepository();
  const tasks = new InMemoryTaskRepository();
  const useCase = new ListTasks(
    tasks,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );
  return { memberships, tasks, useCase };
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

describe("ListTasks", () => {
  it("lista sem filters e com {}", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.tasks.create(
      task("66666666-6666-4666-8666-666666666666", COMPANY_ID, "2026-08-12T10:00:00Z"),
    );

    await expect(sut.useCase.execute({ actor: actor() })).resolves.toHaveLength(1);
    await expect(sut.useCase.execute({ actor: actor(), filters: {} })).resolves.toHaveLength(1);
  });

  it("aplica os filtros oficiais", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.tasks.create(
      task("66666666-6666-4666-8666-666666666666", COMPANY_ID, "2026-08-12T10:00:00Z", {
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: ASSIGNEE_ID,
        requisitionId: REQUISITION_ID,
      }),
    );
    await sut.tasks.create(
      task("77777777-7777-4777-8777-777777777777", COMPANY_ID, "2026-08-12T11:00:00Z"),
    );

    await expect(
      sut.useCase.execute({ actor: actor(), filters: { status: "IN_PROGRESS" } }),
    ).resolves.toHaveLength(1);
    await expect(
      sut.useCase.execute({ actor: actor(), filters: { priority: "HIGH" } }),
    ).resolves.toHaveLength(1);
    await expect(
      sut.useCase.execute({ actor: actor(), filters: { assigneeId: ASSIGNEE_ID } }),
    ).resolves.toHaveLength(1);
    await expect(
      sut.useCase.execute({ actor: actor(), filters: { requisitionId: REQUISITION_ID } }),
    ).resolves.toHaveLength(1);
    await expect(
      sut.useCase.execute({
        actor: actor(),
        filters: {
          status: "IN_PROGRESS",
          priority: "HIGH",
          assigneeId: ASSIGNEE_ID,
          requisitionId: REQUISITION_ID,
        },
      }),
    ).resolves.toHaveLength(1);
  });

  it("rejeita filtros inválidos e campos extras", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);

    await expect(
      sut.useCase.execute({ actor: actor(), filters: { status: "INVALID" } as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      sut.useCase.execute({ actor: actor(), filters: { search: "text" } as never }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("retorna lista vazia e preserva ordenação do repository", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.tasks.create(
      task("99999999-9999-4999-8999-999999999999", COMPANY_ID, "2026-08-12T10:00:00Z"),
    );
    await sut.tasks.create(
      task("88888888-8888-4888-8888-888888888888", COMPANY_ID, "2026-08-12T12:00:00Z"),
    );

    const output = await sut.useCase.execute({ actor: actor() });
    expect(output.map((item) => item.id)).toEqual([
      "99999999-9999-4999-8999-999999999999",
      "88888888-8888-4888-8888-888888888888",
    ]);

    const empty = buildSut();
    await seedActor(empty.memberships);
    await expect(empty.useCase.execute({ actor: actor() })).resolves.toEqual([]);
  });

  it("exige tasks.read e membership ativa", async () => {
    const forbidden = buildSut();
    await seedActor(forbidden.memberships);
    await expect(forbidden.useCase.execute({ actor: actor("none") })).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const inactive = buildSut();
    await seedActor(inactive.memberships, false);
    await expect(inactive.useCase.execute({ actor: actor() })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("usa somente actor.companyId e não carrega histórico", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await sut.tasks.create(
      task("66666666-6666-4666-8666-666666666666", COMPANY_ID, "2026-08-12T10:00:00Z"),
    );
    await sut.tasks.create(
      task("77777777-7777-4777-8777-777777777777", OTHER_COMPANY_ID, "2026-08-12T09:00:00Z"),
    );

    const output = await sut.useCase.execute({ actor: actor() });
    expect(output).toHaveLength(1);
    expect(output[0]?.companyId).toBe(COMPANY_ID);
  });
});
