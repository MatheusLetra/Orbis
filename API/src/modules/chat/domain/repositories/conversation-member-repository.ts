import type { ConversationMember } from "@/modules/chat/domain/entities/conversation-member";

export interface ConversationParticipant {
  userId: string;
  name: string;
}

export interface ConversationMemberRepository {
  create(member: ConversationMember): Promise<ConversationMember>;
  update(member: ConversationMember): Promise<ConversationMember>;
  find(conversationId: string, userId: string): Promise<ConversationMember | null>;
  listParticipants(conversationId: string): Promise<ConversationParticipant[]>;
}
