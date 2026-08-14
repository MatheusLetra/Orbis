import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { chatClient } from "./chat-client";
import { conversation, message, messagePage } from "./chat-test-fixtures";

describe("chatClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("codifica IDs, query e repassa AbortSignal", async () => {
    const request = vi
      .spyOn(apiClient, "request")
      .mockResolvedValueOnce({ items: [conversation] })
      .mockResolvedValueOnce(messagePage);
    const signal = new AbortController().signal;
    await chatClient.listConversations("company/a", { signal });
    await chatClient.listMessages("company/a", "conversation/a", "cursor/a+b", { signal });
    expect(request).toHaveBeenNthCalledWith(1, "/companies/company%2Fa/conversations", { signal });
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/companies/company%2Fa/conversations/conversation%2Fa/messages?limit=50&before=cursor%2Fa%2Bb",
      { signal },
    );
  });

  it("envia bodies estritos e PATCH sem body", async () => {
    const request = vi
      .spyOn(apiClient, "request")
      .mockResolvedValueOnce(conversation)
      .mockResolvedValueOnce(message)
      .mockResolvedValueOnce({
        conversationId: "conversation-1",
        lastReadAt: "2026-08-14T13:00:00Z",
        unreadCount: 0,
      });
    await chatClient.createConversation("company/a", "participant-1");
    await chatClient.sendMessage("company/a", "conversation/a", "Olá");
    await chatClient.markRead("company/a", "conversation/a");
    expect(request).toHaveBeenNthCalledWith(1, "/companies/company%2Fa/conversations", {
      method: "POST",
      body: { participantId: "participant-1" },
    });
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/companies/company%2Fa/conversations/conversation%2Fa/messages",
      {
        method: "POST",
        body: { body: "Olá" },
      },
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      "/companies/company%2Fa/conversations/conversation%2Fa/read",
      { method: "PATCH" },
    );
  });

  it("omite before na primeira página e rejeita respostas fora do contrato", async () => {
    const request = vi
      .spyOn(apiClient, "request")
      .mockResolvedValueOnce(messagePage)
      .mockResolvedValueOnce({ items: [], extra: true });
    await chatClient.listMessages("company/a", "conversation/a", null);
    expect(request).toHaveBeenNthCalledWith(
      1,
      "/companies/company%2Fa/conversations/conversation%2Fa/messages?limit=50",
      undefined,
    );
    await expect(chatClient.listConversations("company-a")).rejects.toThrow("Contrato");
  });

  it("valida respostas de create, send e read na borda HTTP", async () => {
    vi.spyOn(apiClient, "request")
      .mockResolvedValueOnce({ ...conversation, type: "group" })
      .mockResolvedValueOnce({ ...message, body: null })
      .mockResolvedValueOnce({
        conversationId: "conversation-1",
        lastReadAt: "2026-08-14T13:00:00Z",
        unreadCount: 1,
      });
    await expect(chatClient.createConversation("company-a", "participant-a")).rejects.toThrow(
      "Contrato",
    );
    await expect(chatClient.sendMessage("company-a", "conversation-1", "Olá")).rejects.toThrow(
      "Contrato",
    );
    await expect(chatClient.markRead("company-a", "conversation-1")).rejects.toThrow("Contrato");
  });
});
