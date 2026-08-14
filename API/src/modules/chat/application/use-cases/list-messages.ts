import {
  listMessagesSchema,
  parseInput,
  toMessageOutput,
} from "@/modules/chat/application/dto/chat-dtos";
import {
  decodeMessageCursor,
  encodeMessageCursor,
} from "@/modules/chat/application/dto/message-cursor";
import type { ChatAuthorizationService } from "@/modules/chat/application/services/chat-authorization-service";
import type { ConversationRepository } from "@/modules/chat/domain/repositories/conversation-repository";
import type { MessageRepository } from "@/modules/chat/domain/repositories/message-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { NotFoundError } from "@/shared/errors/typed-errors";

export class ListMessages {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly access: ChatAuthorizationService,
  ) {}

  async execute(input: { actor: AuthenticatedUser; conversationId: string; query: unknown }) {
    await this.access.assertActor(input.actor);
    const query = parseInput(listMessagesSchema, input.query);
    const conversation = await this.conversations.findForParticipant(
      input.actor.companyId,
      input.actor.userId,
      input.conversationId,
    );
    if (!conversation) throw new NotFoundError("Conversa não encontrada");
    const rows = await this.messages.listBefore(
      conversation.id,
      query.limit + 1,
      query.before ? decodeMessageCursor(query.before) : undefined,
    );
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit).reverse();
    const oldest = items[0];
    return {
      items: items.map(toMessageOutput),
      hasMore,
      nextCursor:
        hasMore && oldest
          ? encodeMessageCursor({ createdAt: oldest.createdAt, id: oldest.id })
          : null,
    };
  }
}
