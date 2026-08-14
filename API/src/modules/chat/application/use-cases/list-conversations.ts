import type { ChatAuthorizationService } from "@/modules/chat/application/services/chat-authorization-service";
import { toConversationOutput } from "@/modules/chat/application/services/conversation-output-service";
import type { ConversationMemberRepository } from "@/modules/chat/domain/repositories/conversation-member-repository";
import type { ConversationRepository } from "@/modules/chat/domain/repositories/conversation-repository";
import type { MessageRepository } from "@/modules/chat/domain/repositories/message-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";

export class ListConversations {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly members: ConversationMemberRepository,
    private readonly messages: MessageRepository,
    private readonly access: ChatAuthorizationService,
  ) {}

  async execute(input: { actor: AuthenticatedUser }) {
    await this.access.assertActor(input.actor);
    const conversations = await this.conversations.listForParticipant(
      input.actor.companyId,
      input.actor.userId,
    );
    return {
      items: await Promise.all(
        conversations.map((conversation) =>
          toConversationOutput(conversation, input.actor.userId, this.members, this.messages),
        ),
      ),
    };
  }
}
