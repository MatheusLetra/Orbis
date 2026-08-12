import type { Database } from "@/infrastructure/database/client";
import type {
  AttachmentUnitOfWork,
  AttachmentUnitOfWorkContext,
} from "@/modules/attachments/application/ports/attachment-unit-of-work";
import { DrizzleAttachmentBlobRepository } from "@/modules/attachments/infrastructure/repositories/drizzle-attachment-blob-repository";
import { DrizzleAttachmentRepository } from "@/modules/attachments/infrastructure/repositories/drizzle-attachment-repository";

export class DrizzleAttachmentUnitOfWork implements AttachmentUnitOfWork {
  constructor(private readonly db: Database) {}

  async execute<T>(callback: (context: AttachmentUnitOfWorkContext) => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) => {
      return callback({
        attachments: new DrizzleAttachmentRepository(transaction),
        blobs: new DrizzleAttachmentBlobRepository(transaction),
      });
    });
  }
}
