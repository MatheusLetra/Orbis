import {
  createDirectConversationSchema,
  parseInput,
} from "@/modules/chat/application/dto/chat-dtos";
import type { ChatUnitOfWork } from "@/modules/chat/application/ports/chat-unit-of-work";
import type { ChatAuthorizationService } from "@/modules/chat/application/services/chat-authorization-service";
import { toConversationOutput } from "@/modules/chat/application/services/conversation-output-service";
import { Conversation } from "@/modules/chat/domain/entities/conversation";
import { ConversationMember } from "@/modules/chat/domain/entities/conversation-member";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";

export class CreateDirectConversation {
  constructor(
    private readonly unitOfWork: ChatUnitOfWork,
    private readonly access: ChatAuthorizationService,
  ) {}

  async execute(input: { actor: AuthenticatedUser; data: unknown }) {
    await this.access.assertActor(input.actor);
    const data = parseInput(createDirectConversationSchema, input.data);
    await this.access.assertParticipant(input.actor, data.participantId);
    return this.unitOfWork.execute(async ({ conversations, members, messages }) => {
      const conversation = Conversation.create(input.actor.companyId, [
        input.actor.userId,
        data.participantId,
      ]);
      const created = await conversations.create(conversation);
      await members.create(
        ConversationMember.create(created.id, input.actor.userId, created.createdAt),
      );
      await members.create(
        ConversationMember.create(created.id, data.participantId, created.createdAt),
      );
      return toConversationOutput(created, input.actor.userId, members, messages);
    });
  }
}
