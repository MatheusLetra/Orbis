export const chatKeys = {
  all: ["chat"] as const,
  company: (companyId: string) => [...chatKeys.all, "company", companyId] as const,
  conversations: (companyId: string) => [...chatKeys.company(companyId), "conversations"] as const,
  conversation: (companyId: string, conversationId: string) =>
    [...chatKeys.company(companyId), "conversation", conversationId] as const,
  messages: (companyId: string, conversationId: string, limit = 50) =>
    [...chatKeys.conversation(companyId, conversationId), "messages", { limit }] as const,
  messagePage: (companyId: string, conversationId: string, before: string | null, limit = 50) =>
    [...chatKeys.messages(companyId, conversationId, limit), "page", { before }] as const,
};
