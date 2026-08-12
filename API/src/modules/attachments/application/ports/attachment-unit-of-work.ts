import type { AttachmentBlobRepository } from "@/modules/attachments/domain/repositories/attachment-blob-repository";
import type { AttachmentRepository } from "@/modules/attachments/domain/repositories/attachment-repository";

export interface AttachmentUnitOfWorkContext {
  attachments: AttachmentRepository;
  blobs: AttachmentBlobRepository;
}

export interface AttachmentUnitOfWork {
  execute<T>(callback: (context: AttachmentUnitOfWorkContext) => Promise<T>): Promise<T>;
}
