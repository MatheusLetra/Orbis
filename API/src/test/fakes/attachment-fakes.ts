import type {
  AttachmentUnitOfWork,
  AttachmentUnitOfWorkContext,
} from "@/modules/attachments/application/ports/attachment-unit-of-work";
import type { Attachment } from "@/modules/attachments/domain/entities/attachment";
import type { AttachmentBlobRepository } from "@/modules/attachments/domain/repositories/attachment-blob-repository";
import type { AttachmentRepository } from "@/modules/attachments/domain/repositories/attachment-repository";

export class InMemoryAttachmentRepository implements AttachmentRepository {
  readonly items = new Map<string, Attachment>();

  async create(attachment: Attachment): Promise<Attachment> {
    this.items.set(attachment.id, attachment);
    return attachment;
  }

  async findById(companyId: string, owner: Attachment["owner"], attachmentId: string) {
    const attachment = this.items.get(attachmentId);
    if (!attachment || attachment.companyId !== companyId || !sameOwner(attachment.owner, owner))
      return null;
    return attachment;
  }

  async listByOwner(companyId: string, owner: Attachment["owner"]): Promise<Attachment[]> {
    return [...this.items.values()].filter(
      (attachment) => attachment.companyId === companyId && sameOwner(attachment.owner, owner),
    );
  }

  async delete(companyId: string, owner: Attachment["owner"], attachmentId: string): Promise<void> {
    const attachment = await this.findById(companyId, owner, attachmentId);
    if (attachment) this.items.delete(attachmentId);
  }
}

export class InMemoryAttachmentBlobRepository implements AttachmentBlobRepository {
  readonly items = new Map<string, Buffer>();

  async create(attachmentId: string, data: Buffer): Promise<void> {
    this.items.set(attachmentId, data);
  }

  async findByAttachmentId(attachmentId: string): Promise<Buffer | null> {
    return this.items.get(attachmentId) ?? null;
  }
}

export class InMemoryAttachmentUnitOfWork implements AttachmentUnitOfWork {
  constructor(
    readonly attachments = new InMemoryAttachmentRepository(),
    readonly blobs = new InMemoryAttachmentBlobRepository(),
  ) {}

  async execute<T>(callback: (context: AttachmentUnitOfWorkContext) => Promise<T>): Promise<T> {
    const attachmentItems = new Map(this.attachments.items);
    const blobItems = new Map(this.blobs.items);
    try {
      return await callback({ attachments: this.attachments, blobs: this.blobs });
    } catch (error) {
      this.attachments.items.clear();
      for (const [id, attachment] of attachmentItems) this.attachments.items.set(id, attachment);
      this.blobs.items.clear();
      for (const [id, data] of blobItems) this.blobs.items.set(id, data);
      throw error;
    }
  }
}

function sameOwner(a: Attachment["owner"], b: Attachment["owner"]): boolean {
  if (a.type !== b.type) return false;
  return a.type === "REQUISITION"
    ? b.type === "REQUISITION" && a.requisitionId === b.requisitionId
    : b.type === "TASK" && a.taskId === b.taskId;
}
