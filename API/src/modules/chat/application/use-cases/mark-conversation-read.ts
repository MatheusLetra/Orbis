import type { ChatAuthorizationService } from "@/modules/chat/application/services/chat-authorization-service";
import type { ConversationMemberRepository } from "@/modules/chat/domain/repositories/conversation-member-repository";
import type { ConversationRepository } from "@/modules/chat/domain/repositories/conversation-repository";
import type { MessageRepository } from "@/modules/chat/domain/repositories/message-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { NotFoundError } from "@/shared/errors/typed-errors";

export class MarkConversationRead {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly members: ConversationMemberRepository,
    private readonly messages: MessageRepository,
    private readonly access: ChatAuthorizationService,
  ) {}

  async execute(input: { actor: AuthenticatedUser; conversationId: string }) {
    await this.access.assertActor(input.actor);
    const conversation = await this.conversations.findForParticipant(
      input.actor.companyId,
      input.actor.userId,
      input.conversationId,
    );
    if (!conversation) throw new NotFoundError("Conversa não encontrada");
    const member = await this.members.find(conversation.id, input.actor.userId);
    if (!member) throw new NotFoundError("Conversa não encontrada");
    const latest = await this.messages.findLatestFromOthers(conversation.id, input.actor.userId);
    if (latest && (member.lastReadAt === null || latest.createdAt > member.lastReadAt)) {
      member.markRead(new Date());
      await this.members.update(member);
    }
    return {
      conversationId: conversation.id,
      lastReadAt: member.lastReadAt?.toISOString() ?? null,
      unreadCount: 0 as const,
    };
  }
}
