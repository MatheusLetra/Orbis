import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { conversationMembers, users } from "@/infrastructure/database/schema";
import { ConversationMember } from "@/modules/chat/domain/entities/conversation-member";
import type { ConversationMemberRepository } from "@/modules/chat/domain/repositories/conversation-member-repository";
import { requireRow } from "@/shared/utils/require-row";

type Row = typeof conversationMembers.$inferSelect;
type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;
const toEntity = (row: Row) => ConversationMember.restore(row);

export class DrizzleConversationMemberRepository implements ConversationMemberRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(member: ConversationMember): Promise<ConversationMember> {
    const rows = await this.db
      .insert(conversationMembers)
      .values({
        id: member.id,
        conversationId: member.conversationId,
        userId: member.userId,
        lastReadAt: member.lastReadAt,
        createdAt: member.createdAt,
      })
      .returning();
    return toEntity(requireRow(rows[0]));
  }

  async update(member: ConversationMember): Promise<ConversationMember> {
    const rows = await this.db
      .update(conversationMembers)
      .set({ lastReadAt: member.lastReadAt })
      .where(
        and(
          eq(conversationMembers.conversationId, member.conversationId),
          eq(conversationMembers.userId, member.userId),
        ),
      )
      .returning();
    return toEntity(requireRow(rows[0]));
  }

  async find(conversationId: string, userId: string): Promise<ConversationMember | null> {
    const row = (
      await this.db
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, userId),
          ),
        )
        .limit(1)
    )[0];
    return row ? toEntity(row) : null;
  }

  async listParticipants(conversationId: string) {
    return this.db
      .select({ userId: users.id, name: users.name })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(eq(conversationMembers.conversationId, conversationId))
      .orderBy(asc(users.id));
  }
}
