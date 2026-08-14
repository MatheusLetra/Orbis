import type { Conversation } from "@/modules/chat/domain/entities/conversation";

export interface ConversationRepository {
  create(conversation: Conversation): Promise<Conversation>;
  update(conversation: Conversation): Promise<Conversation>;
  findForParticipant(
    companyId: string,
    userId: string,
    conversationId: string,
  ): Promise<Conversation | null>;
  listForParticipant(companyId: string, userId: string): Promise<Conversation[]>;
}
