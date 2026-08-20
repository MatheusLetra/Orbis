import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import {
  parseChatParticipantList,
  parseConversation,
  parseConversationList,
  parseMessage,
  parseMessagePage,
  parseReadOutput,
} from "./chat-contracts";

const MESSAGE_LIMIT = 50;
type SignalOptions = Pick<RequestOptions, "signal">;

export const chatClient = {
  listConversations(companyId: string, options?: SignalOptions) {
    return apiClient
      .request<unknown>(`/companies/${encodeURIComponent(companyId)}/conversations`, options)
      .then(parseConversationList);
  },

  listParticipants(companyId: string, search: string, options?: SignalOptions) {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/chat/participants${query.toString() ? `?${query}` : ""}`,
        options,
      )
      .then(parseChatParticipantList);
  },

  createConversation(companyId: string, participantId: string, options?: SignalOptions) {
    return apiClient
      .request<unknown>(`/companies/${encodeURIComponent(companyId)}/conversations`, {
        ...options,
        method: "POST",
        body: { participantId },
      })
      .then(parseConversation);
  },

  listMessages(
    companyId: string,
    conversationId: string,
    before: string | null,
    options?: SignalOptions,
  ) {
    const query = new URLSearchParams({ limit: String(MESSAGE_LIMIT) });
    if (before) query.set("before", before);
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`,
        options,
      )
      .then(parseMessagePage);
  },

  sendMessage(companyId: string, conversationId: string, body: string, options?: SignalOptions) {
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          ...options,
          method: "POST",
          body: { body },
        },
      )
      .then(parseMessage);
  },

  markRead(companyId: string, conversationId: string, options?: SignalOptions) {
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/conversations/${encodeURIComponent(conversationId)}/read`,
        {
          ...options,
          method: "PATCH",
        },
      )
      .then(parseReadOutput);
  },
};

export { MESSAGE_LIMIT };
