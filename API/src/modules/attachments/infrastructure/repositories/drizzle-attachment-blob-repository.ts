import { eq } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { attachmentBlobs } from "@/infrastructure/database/schema";
import type { AttachmentBlobRepository } from "@/modules/attachments/domain/repositories/attachment-blob-repository";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

export class DrizzleAttachmentBlobRepository implements AttachmentBlobRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(attachmentId: string, data: Buffer): Promise<void> {
    await this.db.insert(attachmentBlobs).values({ attachmentId, data });
  }

  async findByAttachmentId(attachmentId: string): Promise<Buffer | null> {
    const row = (
      await this.db
        .select({ data: attachmentBlobs.data })
        .from(attachmentBlobs)
        .where(eq(attachmentBlobs.attachmentId, attachmentId))
    )[0];

    return row ? Buffer.from(row.data) : null;
  }
}
