import { describe, expect, it } from "vitest";
import { ListAttachments } from "@/modules/attachments/application/use-cases/list-attachments";
import type { Attachment, AttachmentOwner } from "@/modules/attachments/domain/entities/attachment";
import type { AttachmentRepository } from "@/modules/attachments/domain/repositories/attachment-repository";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { Task } from "@/modules/tasks/domain/entities/task";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, NotFoundError } from "@/shared/errors/typed-errors";

const companyId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const requisitionId = "33333333-3333-4333-8333-333333333333";
const taskId = "44444444-4444-4444-8444-444444444444";
const owner: AttachmentOwner = { type: "REQUISITION", requisitionId };
const actor: AuthenticatedUser = {
  userId,
  companyId,
  permissions: ["requisitions.read", "tasks.read"],
};

class FakeMemberships implements MembershipRepository {
  active = true;
  async findByUserAndCompany() {
    return this.active ? ({ isActive: true } as never) : null;
  }
  async create(value: never) {
    return value;
  }
  async listByCompany() {
    return [];
  }
}
class FakeRequisitions implements RequisitionRepository {
  item: Requisition | null = { companyId } as Requisition;
  async create(value: Requisition) {
    return value;
  }
  async findById() {
    return this.item;
  }
  async update(value: Requisition) {
    return value;
  }
  async delete() {}
  async listByCompany() {
    return [];
  }
}
class FakeTasks implements TaskRepository {
  item: Task | null = { companyId } as Task;
  async create(value: Task) {
    return value;
  }
  async findById() {
    return this.item;
  }
  async findByIdForUpdate() {
    return this.item;
  }
  async update(value: Task) {
    return value;
  }
  async listByCompany() {
    return [];
  }
}
class FakeAttachments implements AttachmentRepository {
  items: Attachment[] = [];
  received: { companyId: string; owner: AttachmentOwner } | null = null;
  async create(value: Attachment) {
    return value;
  }
  async findById() {
    return null;
  }
  async listByOwner(receivedCompanyId: string, receivedOwner: AttachmentOwner) {
    this.received = { companyId: receivedCompanyId, owner: receivedOwner };
    return this.items;
  }
  async delete() {}
}

function setup() {
  const memberships = new FakeMemberships();
  const requisitions = new FakeRequisitions();
  const tasks = new FakeTasks();
  const attachments = new FakeAttachments();
  const useCase = new ListAttachments(
    attachments,
    requisitions,
    tasks,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );
  return { useCase, memberships, requisitions, tasks, attachments };
}

describe("ListAttachments", () => {
  it("lista metadata do owner de Requisition e preserva ordem/output", async () => {
    const { useCase, attachments } = setup();
    const first = {
      id: "a",
      companyId,
      kind: "LINK",
      owner,
      title: "A",
      createdAt: new Date(),
    } as never as Attachment;
    const second = {
      id: "b",
      companyId,
      kind: "LINK",
      owner,
      title: "B",
      createdAt: new Date(),
    } as never as Attachment;
    attachments.items = [first, second];
    const result = await useCase.execute({ actor, data: { owner } });
    expect(result.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result[0]).not.toHaveProperty("data");
    expect(attachments.received).toEqual({ companyId, owner });
  });

  it("retorna lista vazia", async () => {
    const { useCase } = setup();
    await expect(useCase.execute({ actor, data: { owner } })).resolves.toEqual([]);
  });

  it("usa tasks.read para Task, inclusive DONE", async () => {
    const { useCase, tasks } = setup();
    tasks.item = { companyId, status: "DONE" } as Task;
    const taskOwner: AttachmentOwner = { type: "TASK", taskId };
    const result = await useCase.execute({ actor, data: { owner: taskOwner } });
    expect(result).toEqual([]);
  });

  it("rejeita membership, owner inválido e parent inválido antes da listagem", async () => {
    const first = setup();
    first.memberships.active = false;
    await expect(first.useCase.execute({ actor, data: { owner } })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(first.attachments.received).toBeNull();

    const second = setup();
    await expect(
      second.useCase.execute({ actor, data: { owner: { type: "OTHER" } as never } }),
    ).rejects.toThrow();
    expect(second.attachments.received).toBeNull();

    const third = setup();
    third.requisitions.item = null;
    await expect(third.useCase.execute({ actor, data: { owner } })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(third.attachments.received).toBeNull();
  });

  it("rejeita parent de outro tenant e usa companyId do actor", async () => {
    const { useCase, requisitions, attachments } = setup();
    requisitions.item = { companyId: "55555555-5555-4555-8555-555555555555" } as Requisition;
    await expect(useCase.execute({ actor, data: { owner } })).rejects.toBeInstanceOf(NotFoundError);
    expect(attachments.received).toBeNull();
  });
});
