import type { ConversationOutput, MessageOutput, MessagePageOutput } from "./chat-contracts";

export const message: MessageOutput = {
  id: "message-1",
  conversationId: "conversation-1",
  senderId: "user-2",
  body: "Olá",
  createdAt: "2026-08-14T12:00:00Z",
};

export const conversation: ConversationOutput = {
  id: "conversation-1",
  companyId: "company-1",
  type: "direct",
  participants: [
    { userId: "user-1", name: "Matheus" },
    { userId: "user-2", name: "Ana" },
  ],
  lastMessage: message,
  unreadCount: 1,
  createdAt: "2026-08-14T11:00:00Z",
  updatedAt: "2026-08-14T12:00:00Z",
};

export const messagePage: MessagePageOutput = {
  items: [message],
  hasMore: false,
  nextCursor: null,
};
