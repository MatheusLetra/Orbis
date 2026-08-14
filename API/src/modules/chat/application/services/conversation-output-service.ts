import type { ConversationOutput } from "@/modules/chat/application/dto/chat-dtos";
import { toMessageOutput } from "@/modules/chat/application/dto/chat-dtos";
import type { Conversation } from "@/modules/chat/domain/entities/conversation";
import type { ConversationMemberRepository } from "@/modules/chat/domain/repositories/conversation-member-repository";
import type { MessageRepository } from "@/modules/chat/domain/repositories/message-repository";
import { NotFoundError } from "@/shared/errors/typed-errors";

export async function toConversationOutput(
  conversation: Conversation,
  actorId: string,
  members: ConversationMemberRepository,
  messages: MessageRepository,
): Promise<ConversationOutput> {
  const [participants, lastMessage, actorMember] = await Promise.all([
    members.listParticipants(conversation.id),
    messages.findLatest(conversation.id),
    members.find(conversation.id, actorId),
  ]);
  if (!actorMember) throw new NotFoundError("Conversa não encontrada");
  const unreadCount = await messages.countUnread(conversation.id, actorId, actorMember.lastReadAt);
  return {
    id: conversation.id,
    companyId: conversation.companyId,
    type: "direct",
    participants,
    lastMessage: lastMessage ? toMessageOutput(lastMessage) : null,
    unreadCount,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}
