export interface AttachmentBlobRepository {
  create(attachmentId: string, data: Buffer): Promise<void>;
  findByAttachmentId(attachmentId: string): Promise<Buffer | null>;
}
