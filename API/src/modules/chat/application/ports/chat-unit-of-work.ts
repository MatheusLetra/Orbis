import type { ConversationMemberRepository } from "@/modules/chat/domain/repositories/conversation-member-repository";
import type { ConversationRepository } from "@/modules/chat/domain/repositories/conversation-repository";
import type { MessageRepository } from "@/modules/chat/domain/repositories/message-repository";

export interface ChatUnitOfWorkContext {
  conversations: ConversationRepository;
  members: ConversationMemberRepository;
  messages: MessageRepository;
}

export interface ChatUnitOfWork {
  execute<T>(callback: (context: ChatUnitOfWorkContext) => Promise<T>): Promise<T>;
}
