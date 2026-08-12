import type { Attachment, AttachmentOwner } from "@/modules/attachments/domain/entities/attachment";

export interface AttachmentRepository {
  create(attachment: Attachment): Promise<Attachment>;
  findById(
    companyId: string,
    owner: AttachmentOwner,
    attachmentId: string,
  ): Promise<Attachment | null>;
  listByOwner(companyId: string, owner: AttachmentOwner): Promise<Attachment[]>;
  delete(companyId: string, owner: AttachmentOwner, attachmentId: string): Promise<void>;
}
