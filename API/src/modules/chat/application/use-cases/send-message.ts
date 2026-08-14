import {
  parseInput,
  sendMessageSchema,
  toMessageOutput,
} from "@/modules/chat/application/dto/chat-dtos";
import type { ChatUnitOfWork } from "@/modules/chat/application/ports/chat-unit-of-work";
import type { ChatAuthorizationService } from "@/modules/chat/application/services/chat-authorization-service";
import { Message } from "@/modules/chat/domain/entities/message";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { NotFoundError } from "@/shared/errors/typed-errors";

export class SendMessage {
  constructor(
    private readonly unitOfWork: ChatUnitOfWork,
    private readonly access: ChatAuthorizationService,
  ) {}

  async execute(input: { actor: AuthenticatedUser; conversationId: string; data: unknown }) {
    await this.access.assertActor(input.actor);
    const data = parseInput(sendMessageSchema, input.data);
    return this.unitOfWork.execute(async ({ conversations, messages }) => {
      const conversation = await conversations.findForParticipant(
        input.actor.companyId,
        input.actor.userId,
        input.conversationId,
      );
      if (!conversation) throw new NotFoundError("Conversa não encontrada");
      const now = new Date();
      const message = await messages.create(
        Message.create(conversation.id, input.actor.userId, data.body, now),
      );
      conversation.touch(now);
      await conversations.update(conversation);
      return toMessageOutput(message);
    });
  }
}
