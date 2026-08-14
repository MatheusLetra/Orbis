import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { conversationMembers, conversations } from "@/infrastructure/database/schema";
import type { ConversationType } from "@/modules/chat/domain/conversation-type";
import { Conversation } from "@/modules/chat/domain/entities/conversation";
import type { ConversationRepository } from "@/modules/chat/domain/repositories/conversation-repository";
import { ConflictError } from "@/shared/errors/typed-errors";
import { requireRow } from "@/shared/utils/require-row";

type Row = typeof conversations.$inferSelect;
type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;
const toEntity = (row: Row) => Conversation.restore({ ...row, type: row.type as ConversationType });

export class DrizzleConversationRepository implements ConversationRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(conversation: Conversation): Promise<Conversation> {
    try {
      const rows = await this.db
        .insert(conversations)
        .values({
          id: conversation.id,
          companyId: conversation.companyId,
          type: conversation.type,
          directKey: conversation.directKey,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        })
        .returning();
      return toEntity(requireRow(rows[0]));
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Conversa direta já existe");
      throw error;
    }
  }

  async update(conversation: Conversation): Promise<Conversation> {
    const rows = await this.db
      .update(conversations)
      .set({ updatedAt: conversation.updatedAt })
      .where(
        and(
          eq(conversations.id, conversation.id),
          eq(conversations.companyId, conversation.companyId),
        ),
      )
      .returning();
    return toEntity(requireRow(rows[0]));
  }

  async findForParticipant(companyId: string, userId: string, conversationId: string) {
    const row = (
      await this.db
        .select({ conversation: conversations })
        .from(conversations)
        .innerJoin(
          conversationMembers,
          and(
            eq(conversationMembers.conversationId, conversations.id),
            eq(conversationMembers.userId, userId),
          ),
        )
        .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)))
        .limit(1)
    )[0];
    return row ? toEntity(row.conversation) : null;
  }

  async listForParticipant(companyId: string, userId: string): Promise<Conversation[]> {
    const rows = await this.db
      .select({ conversation: conversations })
      .from(conversations)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversationMembers.conversationId, conversations.id),
          eq(conversationMembers.userId, userId),
        ),
      )
      .where(eq(conversations.companyId, companyId))
      .orderBy(desc(conversations.updatedAt), desc(conversations.id));
    return rows.map((row) => toEntity(row.conversation));
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}
