export const CONVERSATION_TYPES = ["direct"] as const;

export type ConversationType = (typeof CONVERSATION_TYPES)[number];
