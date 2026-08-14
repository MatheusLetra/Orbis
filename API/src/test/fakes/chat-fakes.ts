import type { MessageCursor } from "@/modules/chat/application/dto/message-cursor";
import type {
  ChatUnitOfWork,
  ChatUnitOfWorkContext,
} from "@/modules/chat/application/ports/chat-unit-of-work";
import type { Conversation } from "@/modules/chat/domain/entities/conversation";
import type { ConversationMember } from "@/modules/chat/domain/entities/conversation-member";
import type { Message } from "@/modules/chat/domain/entities/message";
import type {
  ConversationMemberRepository,
  ConversationParticipant,
} from "@/modules/chat/domain/repositories/conversation-member-repository";
import type { ConversationRepository } from "@/modules/chat/domain/repositories/conversation-repository";
import type { MessageRepository } from "@/modules/chat/domain/repositories/message-repository";
import { ConflictError } from "@/shared/errors/typed-errors";

export class InMemoryConversationRepository implements ConversationRepository {
  readonly items: Conversation[] = [];

  constructor(private readonly members: InMemoryConversationMemberRepository) {}

  async create(conversation: Conversation) {
    if (
      this.items.some(
        (item) =>
          item.companyId === conversation.companyId && item.directKey === conversation.directKey,
      )
    ) {
      throw new ConflictError("Conversa direta já existe");
    }
    this.items.push(conversation);
    return conversation;
  }

  async update(conversation: Conversation) {
    return conversation;
  }

  async findForParticipant(companyId: string, userId: string, conversationId: string) {
    const member = await this.members.find(conversationId, userId);
    if (!member) return null;
    return (
      this.items.find((item) => item.id === conversationId && item.companyId === companyId) ?? null
    );
  }

  async listForParticipant(companyId: string, userId: string) {
    const conversationIds = new Set(
      this.members.items
        .filter((item) => item.userId === userId)
        .map((item) => item.conversationId),
    );
    return this.items
      .filter((item) => item.companyId === companyId && conversationIds.has(item.id))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id));
  }
}

export class InMemoryConversationMemberRepository implements ConversationMemberRepository {
  readonly items: ConversationMember[] = [];
  readonly names = new Map<string, string>();

  async create(member: ConversationMember) {
    this.items.push(member);
    return member;
  }

  async update(member: ConversationMember) {
    return member;
  }

  async find(conversationId: string, userId: string) {
    return (
      this.items.find((item) => item.conversationId === conversationId && item.userId === userId) ??
      null
    );
  }

  async listParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    return this.items
      .filter((item) => item.conversationId === conversationId)
      .map((item) => ({ userId: item.userId, name: this.names.get(item.userId) ?? item.userId }))
      .sort((a, b) => a.userId.localeCompare(b.userId));
  }
}

export class InMemoryMessageRepository implements MessageRepository {
  readonly items: Message[] = [];

  async create(message: Message) {
    this.items.push(message);
    return message;
  }

  async listBefore(conversationId: string, limit: number, before?: MessageCursor) {
    return this.items
      .filter(
        (item) =>
          item.conversationId === conversationId &&
          (!before ||
            item.createdAt < before.createdAt ||
            (item.createdAt.getTime() === before.createdAt.getTime() && item.id < before.id)),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
      .slice(0, limit);
  }

  async findLatest(conversationId: string) {
    return (await this.listBefore(conversationId, 1))[0] ?? null;
  }

  async findLatestFromOthers(conversationId: string, userId: string) {
    return (
      this.items
        .filter((item) => item.conversationId === conversationId && item.senderId !== userId)
        .sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
        )[0] ?? null
    );
  }

  async countUnread(conversationId: string, userId: string, after: Date | null) {
    return this.items.filter(
      (item) =>
        item.conversationId === conversationId &&
        item.senderId !== userId &&
        (after === null || item.createdAt > after),
    ).length;
  }
}

export class InMemoryChatUnitOfWork implements ChatUnitOfWork {
  constructor(private readonly context: ChatUnitOfWorkContext) {}

  async execute<T>(callback: (context: ChatUnitOfWorkContext) => Promise<T>): Promise<T> {
    return callback(this.context);
  }
}
