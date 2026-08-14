import type { Database } from "@/infrastructure/database/client";
import type {
  ChatUnitOfWork,
  ChatUnitOfWorkContext,
} from "@/modules/chat/application/ports/chat-unit-of-work";
import { DrizzleConversationMemberRepository } from "@/modules/chat/infrastructure/repositories/drizzle-conversation-member-repository";
import { DrizzleConversationRepository } from "@/modules/chat/infrastructure/repositories/drizzle-conversation-repository";
import { DrizzleMessageRepository } from "@/modules/chat/infrastructure/repositories/drizzle-message-repository";

export class DrizzleChatUnitOfWork implements ChatUnitOfWork {
  constructor(private readonly db: Database) {}

  async execute<T>(callback: (context: ChatUnitOfWorkContext) => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) =>
      callback({
        conversations: new DrizzleConversationRepository(transaction),
        members: new DrizzleConversationMemberRepository(transaction),
        messages: new DrizzleMessageRepository(transaction),
      }),
    );
  }
}
