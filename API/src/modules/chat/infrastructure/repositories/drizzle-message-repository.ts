import { and, count, desc, eq, gt, lt, ne, or } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { messages } from "@/infrastructure/database/schema";
import type { MessageCursor } from "@/modules/chat/application/dto/message-cursor";
import { Message } from "@/modules/chat/domain/entities/message";
import type { MessageRepository } from "@/modules/chat/domain/repositories/message-repository";
import { requireRow } from "@/shared/utils/require-row";

type Row = typeof messages.$inferSelect;
type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;
const toEntity = (row: Row) => Message.restore(row);

export class DrizzleMessageRepository implements MessageRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(message: Message): Promise<Message> {
    const rows = await this.db
      .insert(messages)
      .values({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
      })
      .returning();
    return toEntity(requireRow(rows[0]));
  }

  async listBefore(conversationId: string, limit: number, before?: MessageCursor) {
    const cursorCondition = before
      ? or(
          lt(messages.createdAt, before.createdAt),
          and(eq(messages.createdAt, before.createdAt), lt(messages.id, before.id)),
        )
      : undefined;
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), cursorCondition))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit);
    return rows.map(toEntity);
  }

  async findLatest(conversationId: string): Promise<Message | null> {
    const row = (
      await this.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1)
    )[0];
    return row ? toEntity(row) : null;
  }

  async findLatestFromOthers(conversationId: string, userId: string): Promise<Message | null> {
    const row = (
      await this.db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), ne(messages.senderId, userId)))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1)
    )[0];
    return row ? toEntity(row) : null;
  }

  async countUnread(conversationId: string, userId: string, after: Date | null): Promise<number> {
    const row = (
      await this.db
        .select({ value: count() })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            ne(messages.senderId, userId),
            after ? gt(messages.createdAt, after) : undefined,
          ),
        )
    )[0];
    return Number(row?.value ?? 0);
  }
}
