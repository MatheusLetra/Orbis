import { count, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infrastructure/database/client";
import { conversationMembers, conversations, messages } from "@/infrastructure/database/schema";
import { Conversation } from "@/modules/chat/domain/entities/conversation";
import { ConversationMember } from "@/modules/chat/domain/entities/conversation-member";
import { Message } from "@/modules/chat/domain/entities/message";
import { DrizzleConversationMemberRepository } from "@/modules/chat/infrastructure/repositories/drizzle-conversation-member-repository";
import { DrizzleConversationRepository } from "@/modules/chat/infrastructure/repositories/drizzle-conversation-repository";
import { DrizzleMessageRepository } from "@/modules/chat/infrastructure/repositories/drizzle-message-repository";
import { DrizzleChatUnitOfWork } from "@/modules/chat/infrastructure/unit-of-work/drizzle-chat-unit-of-work";
import { Company } from "@/modules/companies/domain/entities/company";
import { DrizzleCompanyRepository } from "@/modules/companies/infrastructure/repositories/drizzle-company-repository";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { User } from "@/modules/users/domain/entities/user";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/repositories/drizzle-user-repository";
import { ConflictError } from "@/shared/errors/typed-errors";
import {
  createTestDatabase,
  isTestDatabaseAvailable,
  resetIdentityTables,
} from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();

describe.skipIf(!available)("chat Drizzle + PostgreSQL serial", () => {
  let db: Database;
  let companyId: string;
  let actorId: string;
  let otherId: string;
  let unitOfWork: DrizzleChatUnitOfWork;

  beforeAll(async () => {
    db = await createTestDatabase();
    unitOfWork = new DrizzleChatUnitOfWork(db);
  });

  beforeEach(async () => {
    await resetIdentityTables(db);
    const company = await new DrizzleCompanyRepository(db).create(
      Company.create({ name: "Orbis" }),
    );
    const users = new DrizzleUserRepository(db);
    const actor = await users.create(
      User.create({ email: "actor@chat.dev", name: "Actor", passwordHash: "x" }),
    );
    const other = await users.create(
      User.create({ email: "other@chat.dev", name: "Other", passwordHash: "x" }),
    );
    const memberships = new DrizzleMembershipRepository(db);
    await memberships.create(
      Membership.create({ companyId: company.id, userId: actor.id, position: "developer" }),
    );
    await memberships.create(
      Membership.create({ companyId: company.id, userId: other.id, position: "developer" }),
    );
    companyId = company.id;
    actorId = actor.id;
    otherId = other.id;
  });

  afterAll(async () => {
    await db.$client.end();
  });

  async function createDirect() {
    return unitOfWork.execute(async ({ conversations: repository, members }) => {
      const conversation = await repository.create(
        Conversation.create(companyId, [actorId, otherId]),
      );
      await members.create(ConversationMember.create(conversation.id, actorId));
      await members.create(ConversationMember.create(conversation.id, otherId));
      return conversation;
    });
  }

  it("faz rollback da conversa e do membro já inserido quando a criação falha", async () => {
    await expect(
      unitOfWork.execute(async ({ conversations: repository, members }) => {
        const conversation = await repository.create(
          Conversation.create(companyId, [actorId, otherId]),
        );
        await members.create(ConversationMember.create(conversation.id, actorId));
        throw new Error("falha induzida");
      }),
    ).rejects.toThrow("falha induzida");
    const [conversationRows, memberRows] = await Promise.all([
      db.select({ value: count() }).from(conversations),
      db.select({ value: count() }).from(conversationMembers),
    ]);
    expect(Number(conversationRows[0]?.value)).toBe(0);
    expect(Number(memberRows[0]?.value)).toBe(0);
  });

  it("expõe as garantias críticas da migration de chat", async () => {
    const columns = await db.execute<{
      table_name: string;
      column_name: string;
      is_nullable: string;
    }>(
      sql`
        SELECT table_name, column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN (
            ('conversations', 'direct_key'),
            ('messages', 'edited_at')
          )
      `,
    );
    expect(columns).toContainEqual({
      table_name: "conversations",
      column_name: "direct_key",
      is_nullable: "NO",
    });
    expect(columns).toContainEqual({
      table_name: "messages",
      column_name: "edited_at",
      is_nullable: "YES",
    });

    const indexes = await db.execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('conversations', 'conversation_members', 'messages')
    `);
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "conversations_company_direct_key_unique",
        "conversation_members_conversation_user_unique",
        "conversation_members_user_conversation_idx",
        "messages_conversation_created_id_idx",
      ]),
    );

    await expect(
      db.insert(conversations).values({
        companyId,
        type: "group",
        directKey: `${actorId}:${otherId}`,
      }),
    ).rejects.toThrow();
  });

  it("deduplica criação concorrente pelo par canônico", async () => {
    const results = await Promise.allSettled([createDirect(), createDirect()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: expect.any(ConflictError) });
    const rows = await db.select({ value: count() }).from(conversations);
    expect(Number(rows[0]?.value)).toBe(1);
  });

  it("persiste mensagem e updatedAt no mesmo instante atomicamente", async () => {
    const conversation = await createDirect();
    const at = new Date("2026-08-14T12:00:00.123Z");
    await unitOfWork.execute(
      async ({ conversations: repository, messages: repositoryMessages }) => {
        const scoped = await repository.findForParticipant(companyId, actorId, conversation.id);
        if (!scoped) throw new Error("conversa ausente");
        await repositoryMessages.create(Message.create(scoped.id, actorId, "oi", at));
        scoped.touch(at);
        await repository.update(scoped);
      },
    );
    const [storedConversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversation.id));
    const [storedMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id));
    expect(storedConversation?.updatedAt).toEqual(storedMessage?.createdAt);
    expect(storedMessage?.editedAt).toBeNull();
  });

  it("ordena participantes, pagina por data/id e conta apenas terceiros não lidos", async () => {
    const conversation = await createDirect();
    const memberRepository = new DrizzleConversationMemberRepository(db);
    const messageRepository = new DrizzleMessageRepository(db);
    const conversationRepository = new DrizzleConversationRepository(db);
    const sameTime = new Date("2026-08-14T12:00:00.000Z");
    const low = "00000000-0000-4000-8000-000000000001";
    const high = "00000000-0000-4000-8000-000000000002";
    await messageRepository.create(Message.create(conversation.id, otherId, "um", sameTime, low));
    await messageRepository.create(
      Message.create(conversation.id, actorId, "dois", sameTime, high),
    );
    expect(
      (await memberRepository.listParticipants(conversation.id)).map((item) => item.userId),
    ).toEqual([actorId, otherId].sort());
    expect((await messageRepository.listBefore(conversation.id, 1))[0]?.id).toBe(high);
    expect(await messageRepository.countUnread(conversation.id, actorId, null)).toBe(1);
    const cursorPage = await messageRepository.listBefore(conversation.id, 10, {
      createdAt: sameTime,
      id: high,
    });
    expect(cursorPage.map((item) => item.id)).toEqual([low]);
    expect(
      await messageRepository.countUnread(
        conversation.id,
        actorId,
        new Date(sameTime.getTime() - 1),
      ),
    ).toBe(1);
    expect(await messageRepository.countUnread(conversation.id, actorId, sameTime)).toBe(0);
    expect(await conversationRepository.listForParticipant(companyId, crypto.randomUUID())).toEqual(
      [],
    );
  });
});
