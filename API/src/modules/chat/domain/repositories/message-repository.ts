import type { MessageCursor } from "@/modules/chat/application/dto/message-cursor";
import type { Message } from "@/modules/chat/domain/entities/message";

export interface MessageRepository {
  create(message: Message): Promise<Message>;
  listBefore(conversationId: string, limit: number, before?: MessageCursor): Promise<Message[]>;
  findLatest(conversationId: string): Promise<Message | null>;
  findLatestFromOthers(conversationId: string, userId: string): Promise<Message | null>;
  countUnread(conversationId: string, userId: string, after: Date | null): Promise<number>;
}
