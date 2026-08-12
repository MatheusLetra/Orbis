import { and, asc, eq, isNull } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { attachments } from "@/infrastructure/database/schema";
import type {
  Attachment,
  AttachmentOwner,
  AttachmentProps,
} from "@/modules/attachments/domain/entities/attachment";
import { Attachment as AttachmentEntity } from "@/modules/attachments/domain/entities/attachment";
import type { AttachmentRepository } from "@/modules/attachments/domain/repositories/attachment-repository";
import { requireRow } from "@/shared/utils/require-row";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

function ownerCondition(owner: AttachmentOwner) {
  return owner.type === "REQUISITION"
    ? and(eq(attachments.requisitionId, owner.requisitionId), isNull(attachments.taskId))
    : and(eq(attachments.taskId, owner.taskId), isNull(attachments.requisitionId));
}

function toEntity(row: typeof attachments.$inferSelect): Attachment {
  const owner: AttachmentOwner =
    row.requisitionId !== null && row.taskId === null
      ? { type: "REQUISITION", requisitionId: row.requisitionId }
      : row.taskId !== null && row.requisitionId === null
        ? { type: "TASK", taskId: row.taskId }
        : (() => {
            throw new Error("Anexo com owner estruturalmente inválido");
          })();

  const props: AttachmentProps =
    row.kind === "FILE"
      ? {
          id: row.id,
          companyId: row.companyId,
          owner,
          kind: "FILE",
          title: row.title,
          fileName:
            row.fileName ??
            (() => {
              throw new Error("FILE sem fileName");
            })(),
          mimeType: row.mimeType as NonNullable<AttachmentProps["mimeType"]>,
          checksum:
            row.checksum ??
            (() => {
              throw new Error("FILE sem checksum");
            })(),
          sizeBytes:
            row.sizeBytes ??
            (() => {
              throw new Error("FILE sem sizeBytes");
            })(),
          url:
            row.url === null
              ? null
              : (() => {
                  throw new Error("FILE com URL");
                })(),
          createdBy: row.createdBy,
          createdAt: row.createdAt,
        }
      : {
          id: row.id,
          companyId: row.companyId,
          owner,
          kind: "LINK",
          title: row.title,
          url:
            row.url ??
            (() => {
              throw new Error("LINK sem URL");
            })(),
          fileName:
            row.fileName === null
              ? null
              : (() => {
                  throw new Error("LINK com fileName");
                })(),
          mimeType:
            row.mimeType === null
              ? null
              : (() => {
                  throw new Error("LINK com mimeType");
                })(),
          checksum:
            row.checksum === null
              ? null
              : (() => {
                  throw new Error("LINK com checksum");
                })(),
          sizeBytes:
            row.sizeBytes === null
              ? null
              : (() => {
                  throw new Error("LINK com sizeBytes");
                })(),
          createdBy: row.createdBy,
          createdAt: row.createdAt,
        };

  return AttachmentEntity.restore(props);
}

function toInsertValues(attachment: Attachment) {
  const owner = attachment.owner;
  return {
    id: attachment.id,
    companyId: attachment.companyId,
    requisitionId: owner.type === "REQUISITION" ? owner.requisitionId : null,
    taskId: owner.type === "TASK" ? owner.taskId : null,
    kind: attachment.kind,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    checksum: attachment.checksum,
    sizeBytes: attachment.sizeBytes,
    url: attachment.url,
    title: attachment.title,
    createdBy: attachment.createdBy,
    createdAt: attachment.createdAt,
  };
}

export class DrizzleAttachmentRepository implements AttachmentRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(attachment: Attachment): Promise<Attachment> {
    const rows = await this.db.insert(attachments).values(toInsertValues(attachment)).returning();
    return toEntity(requireRow(rows[0]));
  }

  async findById(
    companyId: string,
    owner: AttachmentOwner,
    attachmentId: string,
  ): Promise<Attachment | null> {
    const row = (
      await this.db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.companyId, companyId),
            eq(attachments.id, attachmentId),
            ownerCondition(owner),
          ),
        )
    )[0];

    return row ? toEntity(row) : null;
  }

  async listByOwner(companyId: string, owner: AttachmentOwner): Promise<Attachment[]> {
    const rows = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.companyId, companyId), ownerCondition(owner)))
      .orderBy(asc(attachments.createdAt), asc(attachments.id));

    return rows.map(toEntity);
  }

  async delete(companyId: string, owner: AttachmentOwner, attachmentId: string): Promise<void> {
    await this.db
      .delete(attachments)
      .where(
        and(
          eq(attachments.companyId, companyId),
          eq(attachments.id, attachmentId),
          ownerCondition(owner),
        ),
      );
  }
}
