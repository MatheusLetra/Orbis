import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GetFileAttachment } from "@/modules/attachments/application/use-cases/get-file-attachment";
import type { Attachment, AttachmentOwner } from "@/modules/attachments/domain/entities/attachment";
import type { AttachmentBlobRepository } from "@/modules/attachments/domain/repositories/attachment-blob-repository";
import type { AttachmentRepository } from "@/modules/attachments/domain/repositories/attachment-repository";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { Task } from "@/modules/tasks/domain/entities/task";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/shared/errors/typed-errors";

const companyId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const requisitionId = "33333333-3333-4333-8333-333333333333";
const taskId = "44444444-4444-4444-8444-444444444444";
const attachmentId = "55555555-5555-4555-8555-555555555555";
const owner: AttachmentOwner = { type: "REQUISITION", requisitionId };
const actor: AuthenticatedUser = {
  userId,
  companyId,
  permissions: ["requisitions.read", "tasks.read"],
};
const data = Buffer.from("%PDF-real-content");
const checksum = createHash("sha256").update(data).digest("hex");

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
  item: Attachment | null = {
    id: attachmentId,
    companyId,
    owner,
    kind: "FILE",
    title: null,
    fileName: "manual.pdf",
    mimeType: "application/pdf",
    checksum,
    sizeBytes: data.length,
    url: null,
    createdBy: userId,
    createdAt: new Date("2026-08-12T10:00:00Z"),
  } as never as Attachment;
  async create(value: Attachment) {
    return value;
  }
  async findById() {
    return this.item;
  }
  async listByOwner() {
    return [];
  }
  async delete() {}
}
class Blobs implements AttachmentBlobRepository {
  data: Buffer | null = data;
  calls = 0;
  async create() {}
  async findByAttachmentId() {
    this.calls += 1;
    return this.data;
  }
}

function setup() {
  const memberships = new Memberships();
  const requisitions = new Requisitions();
  const tasks = new Tasks();
  const attachments = new Attachments();
  const blobs = new Blobs();
  const useCase = new GetFileAttachment(
    attachments,
    blobs,
    requisitions,
    tasks,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );
  return { useCase, memberships, requisitions, tasks, attachments, blobs };
}

describe("GetFileAttachment", () => {
  it("retorna FILE e Buffer íntegro com checksum real", async () => {
    const { useCase, blobs } = setup();
    const result = await useCase.execute({ actor, data: { owner, attachmentId } });
    expect(result.data).toEqual(data);
    expect(result.attachment.checksum).toBe(checksum);
    expect(result.attachment).not.toHaveProperty("data");
    expect(blobs.calls).toBe(1);
  });

  it("permite Task DONE", async () => {
    const { useCase, attachments } = setup();
    const taskOwner: AttachmentOwner = { type: "TASK", taskId };
    attachments.item = { ...(attachments.item as never), owner: taskOwner } as Attachment;
    const result = await useCase.execute({ actor, data: { owner: taskOwner, attachmentId } });
    expect(result.attachment.owner).toEqual(taskOwner);
  });

  it("rejeita LINK sem consultar blob", async () => {
    const { useCase, attachments, blobs } = setup();
    attachments.item = {
      ...(attachments.item as never),
      kind: "LINK",
      url: "https://example.com",
    } as Attachment;
    await expect(useCase.execute({ actor, data: { owner, attachmentId } })).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
    expect(blobs.calls).toBe(0);
  });

  it("rejeita blob ausente e checksum divergente", async () => {
    const first = setup();
    first.blobs.data = null;
    await expect(
      first.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const second = setup();
    second.blobs.data = Buffer.from("%PDF-corrupted");
    await expect(
      second.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("não busca blob antes de falhas de autorização, parent ou metadata", async () => {
    const first = setup();
    first.memberships.active = false;
    await expect(
      first.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(first.blobs.calls).toBe(0);

    const second = setup();
    second.requisitions.item = null;
    await expect(
      second.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(second.blobs.calls).toBe(0);

    const third = setup();
    third.attachments.item = null;
    await expect(
      third.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(third.blobs.calls).toBe(0);
  });

  it("rejeita owner inválido e parent de outro tenant", async () => {
    const first = setup();
    await expect(
      first.useCase.execute({ actor, data: { owner: { type: "OTHER" } as never, attachmentId } }),
    ).rejects.toThrow();
    expect(first.blobs.calls).toBe(0);

    const second = setup();
    second.requisitions.item = { companyId: "66666666-6666-4666-8666-666666666666" } as Requisition;
    await expect(
      second.useCase.execute({ actor, data: { owner, attachmentId } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(second.blobs.calls).toBe(0);
  });
});
