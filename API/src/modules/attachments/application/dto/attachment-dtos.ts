import { z } from "zod";

import type { Attachment, AttachmentOwner } from "@/modules/attachments/domain/entities/attachment";

export const attachmentOwnerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("REQUISITION"), requisitionId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("TASK"), taskId: z.string().uuid() }).strict(),
]);

export const addFileAttachmentSchema = z
  .object({
    owner: attachmentOwnerSchema,
    data: z.instanceof(Buffer),
    fileName: z.string(),
    title: z.string().optional(),
  })
  .strict();

export const addLinkAttachmentSchema = z
  .object({
    owner: attachmentOwnerSchema,
    url: z.string(),
    title: z.string(),
  })
  .strict();

export type AddFileAttachmentInput = z.infer<typeof addFileAttachmentSchema>;
export type AddLinkAttachmentInput = z.infer<typeof addLinkAttachmentSchema>;

export const listAttachmentsSchema = z.object({ owner: attachmentOwnerSchema }).strict();
export const getFileAttachmentSchema = z
  .object({ owner: attachmentOwnerSchema, attachmentId: z.string().uuid() })
  .strict();
export const removeAttachmentSchema = z
  .object({ owner: attachmentOwnerSchema, attachmentId: z.string().uuid() })
  .strict();

export type ListAttachmentsInput = z.infer<typeof listAttachmentsSchema>;
export type GetFileAttachmentInput = z.infer<typeof getFileAttachmentSchema>;
export type RemoveAttachmentInput = z.infer<typeof removeAttachmentSchema>;

export interface AttachmentOutput {
  id: string;
  companyId: string;
  owner: AttachmentOwner;
  kind: "FILE" | "LINK";
  title: string | null;
  fileName: string | null;
  mimeType: string | null;
  checksum: string | null;
  sizeBytes: number | null;
  url: string | null;
  createdBy: string;
  createdAt: string;
}

export function toAttachmentOutput(attachment: Attachment): AttachmentOutput {
  return {
    id: attachment.id,
    companyId: attachment.companyId,
    owner: attachment.owner,
    kind: attachment.kind,
    title: attachment.title,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    checksum: attachment.checksum,
    sizeBytes: attachment.sizeBytes,
    url: attachment.url,
    createdBy: attachment.createdBy,
    createdAt: attachment.createdAt.toISOString(),
  };
}
