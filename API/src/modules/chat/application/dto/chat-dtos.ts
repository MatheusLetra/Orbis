import { z } from "zod";
import type { Message } from "@/modules/chat/domain/entities/message";
import { ValidationError } from "@/shared/errors/typed-errors";

export const createDirectConversationSchema = z.object({ participantId: z.uuid() }).strict();
export const sendMessageSchema = z.object({ body: z.string().trim().min(1).max(5000) }).strict();
export const listMessagesSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().optional(),
  })
  .strict();

export interface MessageOutput {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationOutput {
  id: string;
  companyId: string;
  type: "direct";
  participants: Array<{ userId: string; name: string }>;
  lastMessage: MessageOutput | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toMessageOutput(message: Message): MessageOutput {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError("Entrada inválida", { details: { issues: result.error.issues } });
  }
  return result.data;
}
