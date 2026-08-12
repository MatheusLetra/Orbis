import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import { UpdateTask } from "@/modules/tasks/application/use-cases/update-task";
import { Task } from "@/modules/tasks/domain/entities/task";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/typed-errors";
import { InMemoryTaskRepository } from "@/test/fakes/task-fakes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNEE_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_USER_ID = "55555555-5555-4555-8555-555555555555";
const TASK_ID = "66666666-6666-4666-8666-666666666666";
const REQUISITION_ID = "77777777-7777-4777-8777-777777777777";

class FakeMembershipRepository {
  readonly memberships = new Map<string, Membership>();

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
  readonly requisitions = new Map<string, Requisition>();

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

function makeActor(permissions: "all" | "none" = "all") {
  return {
    userId: ACTOR_ID,
    companyId: COMPANY_ID,
    permissions: permissions === "all" ? ["tasks.update"] : [],
  } as const;
}

function buildTask(overrides: Partial<Parameters<typeof Task.restore>[0]> = {}) {
  const createdAt = new Date("2026-08-12T10:00:00Z");
  return Task.restore({
    id: TASK_ID,
    companyId: COMPANY_ID,
    requisitionId: null,
    title: "Título original",
    description: "Descrição original",
    priority: "LOW",
    status: "TODO",
    assigneeId: null,
    startDate: new Date("2026-08-12T00:00:00Z"),
    plannedEndDate: new Date("2026-08-20T00:00:00Z"),
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

function buildSut() {
  const memberships = new FakeMembershipRepository();
  const requisitions = new FakeRequisitionRepository();
  const tasks = new InMemoryTaskRepository();
  const useCase = new UpdateTask(
    tasks,
    memberships,
    requisitions,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );

  return { memberships, requisitions, tasks, useCase };
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

async function seedAssignee(memberships: FakeMembershipRepository, companyId = COMPANY_ID) {
  await memberships.create(
    Membership.create({ companyId, userId: ASSIGNEE_ID, position: "DESENVOLVEDOR" }),
  );
}

async function seedRequisition(requisitions: FakeRequisitionRepository, companyId = COMPANY_ID) {
  await requisitions.create(
    Requisition.create(
      { companyId, number: 1, title: "Requisição", requesterId: ACTOR_ID },
      REQUISITION_ID,
    ),
  );
}

async function seedTask(sut: ReturnType<typeof buildSut>, task = buildTask()) {
  await sut.tasks.create(task);
}

describe("UpdateTask", () => {
  it("atualiza somente title e normaliza pelo domínio", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await seedTask(sut);

    const output = await sut.useCase.execute({
      actor: makeActor(),
      taskId: TASK_ID,
      changes: { title: "  Novo título  " },
    });

    expect(output.title).toBe("Novo título");
    expect(output.priority).toBe("LOW");
  });

  it("atualiza todos os campos mutáveis", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await seedAssignee(sut.memberships);
    await seedRequisition(sut.requisitions);
    await seedTask(sut);
    const startDate = new Date("2026-09-01T00:00:00Z");
    const plannedEndDate = new Date("2026-09-10T00:00:00Z");

    const output = await sut.useCase.execute({
      actor: makeActor(),
      taskId: TASK_ID,
      changes: {
        title: "Novo título",
        description: "Nova descrição",
        priority: "HIGH",
        assigneeId: ASSIGNEE_ID,
        requisitionId: REQUISITION_ID,
        startDate,
        plannedEndDate,
      },
    });

    expect(output).toMatchObject({
      title: "Novo título",
      description: "Nova descrição",
      priority: "HIGH",
      assigneeId: ASSIGNEE_ID,
      requisitionId: REQUISITION_ID,
      startDate: startDate.toISOString(),
      plannedEndDate: plannedEndDate.toISOString(),
    });
  });

  it("preserva campos ausentes e substitui valores informados", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await seedAssignee(sut.memberships);
    await seedRequisition(sut.requisitions);
    await seedTask(sut);
    const original = await sut.tasks.findById(COMPANY_ID, TASK_ID);

    await sut.useCase.execute({
      actor: makeActor(),
      taskId: TASK_ID,
      changes: { priority: "HIGH" },
    });

    const updated = await sut.tasks.findById(COMPANY_ID, TASK_ID);
    expect(updated?.priority).toBe("HIGH");
    expect(updated?.title).toBe(original?.title);
    expect(updated?.description).toBe(original?.description);
    expect(updated?.assigneeId).toBe(original?.assigneeId);
  });

  it("remove opcionais quando recebem null", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await seedTask(sut);

    await sut.useCase.execute({
      actor: makeActor(),
      taskId: TASK_ID,
      changes: {
        description: null,
        assigneeId: null,
        requisitionId: null,
        startDate: null,
        plannedEndDate: null,
      },
    });

    const updated = await sut.tasks.findById(COMPANY_ID, TASK_ID);
    expect(updated).toMatchObject({
      description: null,
      assigneeId: null,
      requisitionId: null,
      startDate: null,
      plannedEndDate: null,
    });
  });

  it("atualiza priority válida e updatedAt", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await seedTask(sut);
    const before = (await sut.tasks.findById(COMPANY_ID, TASK_ID))?.updatedAt;

    const output = await sut.useCase.execute({
      actor: makeActor(),
      taskId: TASK_ID,
      changes: { priority: "MEDIUM" },
    });

    expect(output.priority).toBe("MEDIUM");
    expect(new Date(output.updatedAt).getTime()).toBeGreaterThanOrEqual(before?.getTime() ?? 0);
  });

  it.each([{ title: "" }, { title: "   " }, { priority: "INVALID" }] as never[])(
    "rejeita campo inválido",
    async (changes) => {
      const sut = buildSut();
      await seedActor(sut.memberships);
      await seedTask(sut);

      await expect(
        sut.useCase.execute({ actor: makeActor(), taskId: TASK_ID, changes }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(sut.tasks.items.get(TASK_ID)?.title).toBe("Título original");
    },
  );

  it("rejeita payload vazio e campos controlados", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await seedTask(sut);

    await expect(
      sut.useCase.execute({ actor: makeActor(), taskId: TASK_ID, changes: {} }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      sut.useCase.execute({
        actor: makeActor(),
        taskId: TASK_ID,
        changes: { status: "DONE" } as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(sut.tasks.updateCalls).toBe(0);
  });

  it("valida assignee ativo do mesmo tenant", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    await seedAssignee(sut.memberships);
    await seedTask(sut);

    await sut.useCase.execute({
      actor: makeActor(),
      taskId: TASK_ID,
      changes: { assigneeId: ASSIGNEE_ID },
    });

    expect((await sut.tasks.findById(COMPANY_ID, TASK_ID))?.assigneeId).toBe(ASSIGNEE_ID);
  });

  it("rejeita assignee inexistente, inativo ou de outro tenant", async () => {
    const missing = buildSut();
    await seedActor(missing.memberships);
    await seedTask(missing);
    await expect(
      missing.useCase.execute({
        actor: makeActor(),
        taskId: TASK_ID,
        changes: { assigneeId: OTHER_USER_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const inactive = buildSut();
    await seedActor(inactive.memberships);
    await seedAssignee(inactive.memberships);
    const membership = await inactive.memberships.findByUserAndCompany(ASSIGNEE_ID, COMPANY_ID);
    membership?.deactivate();
    await seedTask(inactive);
    await expect(
      inactive.useCase.execute({
        actor: makeActor(),
        taskId: TASK_ID,
        changes: { assigneeId: ASSIGNEE_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const foreign = buildSut();
    await seedActor(foreign.memberships);
    await seedAssignee(foreign.memberships, OTHER_COMPANY_ID);
    await seedTask(foreign);
    await expect(
      foreign.useCase.execute({
        actor: makeActor(),
        taskId: TASK_ID,
        changes: { assigneeId: ASSIGNEE_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("valida Requisition do mesmo tenant e rejeita inexistente ou estrangeira", async () => {
    const valid = buildSut();
    await seedActor(valid.memberships);
    await seedRequisition(valid.requisitions);
    await seedTask(valid, buildTask({ requisitionId: null }));
    await valid.useCase.execute({
      actor: makeActor(),
      taskId: TASK_ID,
      changes: { requisitionId: REQUISITION_ID },
    });
    expect((await valid.tasks.findById(COMPANY_ID, TASK_ID))?.requisitionId).toBe(REQUISITION_ID);

    const missing = buildSut();
    await seedActor(missing.memberships);
    await seedTask(missing, buildTask({ requisitionId: null }));
    await expect(
      missing.useCase.execute({
        actor: makeActor(),
        taskId: TASK_ID,
        changes: { requisitionId: REQUISITION_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const foreign = buildSut();
    await seedActor(foreign.memberships);
    await seedRequisition(foreign.requisitions, OTHER_COMPANY_ID);
    await seedTask(foreign, buildTask({ requisitionId: null }));
    await expect(
      foreign.useCase.execute({
        actor: makeActor(),
        taskId: TASK_ID,
        changes: { requisitionId: REQUISITION_ID },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita Task inexistente ou de outro tenant", async () => {
    const missing = buildSut();
    await seedActor(missing.memberships);
    await expect(
      missing.useCase.execute({ actor: makeActor(), taskId: TASK_ID, changes: { title: "X" } }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const foreign = buildSut();
    await seedActor(foreign.memberships);
    await seedTask(foreign, buildTask({ companyId: OTHER_COMPANY_ID }));
    await expect(
      foreign.useCase.execute({ actor: makeActor(), taskId: TASK_ID, changes: { title: "X" } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita falta de permissão e membership inativa do actor", async () => {
    const forbidden = buildSut();
    await seedActor(forbidden.memberships);
    await seedTask(forbidden);
    await expect(
      forbidden.useCase.execute({
        actor: makeActor("none"),
        taskId: TASK_ID,
        changes: { title: "X" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const inactive = buildSut();
    await seedActor(inactive.memberships, false);
    await seedTask(inactive);
    await expect(
      inactive.useCase.execute({ actor: makeActor(), taskId: TASK_ID, changes: { title: "X" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("deixa Task DONE rejeitar mutações e não persiste parcialmente", async () => {
    const sut = buildSut();
    await seedActor(sut.memberships);
    const completedAt = new Date("2026-08-12T12:00:00Z");
    await seedTask(sut, buildTask({ status: "DONE", completedAt }));

    await expect(
      sut.useCase.execute({
        actor: makeActor(),
        taskId: TASK_ID,
        changes: { title: "Não deve salvar", description: null },
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const task = await sut.tasks.findById(COMPANY_ID, TASK_ID);
    expect(task?.title).toBe("Título original");
    expect(task?.status).toBe("DONE");
    expect(task?.completedAt).toBe(completedAt);
  });
});
