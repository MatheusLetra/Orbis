import { describe, expect, it } from "vitest";
import { RemoveAttachment } from "@/modules/attachments/application/use-cases/remove-attachment";
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
const attachmentId = "55555555-5555-4555-8555-555555555555";
const owner: AttachmentOwner = { type: "REQUISITION", requisitionId };
const actor: AuthenticatedUser = {
  userId,
  companyId,
  permissions: ["requisitions.update", "tasks.update"],
};

class Memberships implements MembershipRepository {
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
class Requisitions implements RequisitionRepository {
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
class Tasks implements TaskRepository {
  item: Task | null = { companyId, status: "DONE" } as Task;
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
class Attachments implements AttachmentRepository {
  item: Attachment | null = { id: attachmentId } as Attachment;
  found: { companyId: string; owner: AttachmentOwner; id: string } | null = null;
  deleted: { companyId: string; owner: AttachmentOwner; id: string } | null = null;
  async create(value: Attachment) {
    return value;
  }
  async findById(receivedCompanyId: string, receivedOwner: AttachmentOwner, id: string) {
    this.found = { companyId: receivedCompanyId, owner: receivedOwner, id };
    return this.item;
  }
  async listByOwner() {
    return [];
  }
  async delete(receivedCompanyId: string, receivedOwner: AttachmentOwner, id: string) {
    this.deleted = { companyId: receivedCompanyId, owner: receivedOwner, id };
  }
}

function setup() {
  const memberships = new Memberships();
  const requisitions = new Requisitions();
  const tasks = new Tasks();
  const attachments = new Attachments();
  const useCase = new RemoveAttachment(
    attachments,
    requisitions,
    tasks,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );
  return { useCase, memberships, requisitions, tasks, attachments };
}

describe("RemoveAttachment", () => {
  it("remove FILE com company, owner e id corretos", async () => {
    const { useCase, attachments } = setup();
    await expect(useCase.execute({ actor, data: { owner, attachmentId } })).resolves.toEqual({
      id: attachmentId,
    });
    expect(attachments.found).toEqual({ companyId, owner, id: attachmentId });
    expect(attachments.deleted).toEqual({ companyId, owner, id: attachmentId });
  });

  it("remove LINK e aceita Task DONE", async () => {
    const { useCase, tasks, attachments } = setup();
    const taskOwner: AttachmentOwner = { type: "TASK", taskId };
    tasks.item = { companyId, status: "DONE" } as Task;
    attachments.item = { id: attachmentId, kind: "LINK" } as Attachment;
    await expect(
      useCase.execute({ actor, data: { owner: taskOwner, attachmentId } }),
    ).resolves.toEqual({ id: attachmentId });
    expect(attachments.deleted?.owner).toEqual(taskOwner);
  });

  it("rejeita attachment inexistente, owner inválido e parent inválido", async () => {
    const first = setup();
    first.attachments.item = null;
    await expect(
      first.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(first.attachments.deleted).toBeNull();

    const second = setup();
    await expect(
      second.useCase.execute({ actor, data: { owner: { type: "OTHER" } as never, attachmentId } }),
    ).rejects.toThrow();
    expect(second.attachments.deleted).toBeNull();

    const third = setup();
    third.requisitions.item = null;
    await expect(
      third.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(third.attachments.deleted).toBeNull();
  });

  it("rejeita membership inativa e parent de outro tenant", async () => {
    const first = setup();
    first.memberships.active = false;
    await expect(
      first.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(first.attachments.found).toBeNull();

    const second = setup();
    second.requisitions.item = { companyId: "66666666-6666-4666-8666-666666666666" } as Requisition;
    await expect(
      second.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(second.attachments.deleted).toBeNull();
  });

  it("não usa Unit of Work nem BlobRepository", async () => {
    const { useCase, attachments } = setup();
    await useCase.execute({ actor, data: { owner, attachmentId } });
    expect(attachments.deleted).not.toBeNull();
  });
});
