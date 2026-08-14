import { describe, expect, it } from "vitest";
import {
  parseConversation,
  parseConversationList,
  parseMessage,
  parseMessagePage,
  parseReadOutput,
} from "./chat-contracts";
import { conversation, message, messagePage } from "./chat-test-fixtures";

describe("chat contracts", () => {
  it("aceita os contratos canônicos", () => {
    expect(parseConversationList({ items: [conversation] })).toEqual({ items: [conversation] });
    expect(parseConversation(conversation)).toEqual(conversation);
    expect(parseMessage(message)).toEqual(message);
    expect(parseMessagePage(messagePage)).toEqual(messagePage);
    expect(
      parseReadOutput({
        conversationId: "conversation-1",
        lastReadAt: "2026-08-14T13:00:00Z",
        unreadCount: 0,
      }),
    ).toMatchObject({ unreadCount: 0 });
  });

  it.each([
    null,
    [],
    { ...conversation, extra: true },
    { ...conversation, id: "" },
    { ...conversation, companyId: "" },
    { ...conversation, type: "group" },
    { ...conversation, participants: [] },
    { ...conversation, participants: [{ userId: "", name: "Ana" }] },
    { ...conversation, participants: [{ userId: "user-2", name: "" }] },
    { ...conversation, participants: [{ userId: "user-2", name: "Ana", extra: true }] },
    { ...conversation, lastMessage: { ...message, conversationId: "other" } },
    { ...conversation, lastMessage: "invalid" },
    { ...conversation, unreadCount: -1 },
    { ...conversation, unreadCount: 1.5 },
    { ...conversation, createdAt: "hoje" },
    { ...conversation, updatedAt: "hoje" },
  ])("rejeita conversa inválida %#", (invalid) => {
    expect(() => parseConversation(invalid)).toThrow("Contrato");
  });

  it.each([
    null,
    [],
    { items: [], extra: true },
    { items: "invalid" },
    { items: [{ ...conversation, id: "" }] },
  ])("rejeita lista de conversas inválida %#", (invalid) => {
    expect(() => parseConversationList(invalid)).toThrow("Contrato");
  });

  it.each([
    null,
    [],
    { ...message, extra: true },
    { ...message, id: "" },
    { ...message, conversationId: "" },
    { ...message, senderId: "" },
    { ...message, body: null },
    { ...message, createdAt: "2026-99-99T12:00:00Z" },
  ])("rejeita mensagem inválida %#", (invalid) => {
    expect(() => parseMessage(invalid)).toThrow("Contrato");
  });

  it("rejeita página inconsistente, fora de ordem e com campos extras", () => {
    expect(() => parseMessagePage({ ...messagePage, hasMore: true })).toThrow("Contrato");
    expect(() =>
      parseMessagePage({
        items: [message, { ...message, id: "older", createdAt: "2026-08-14T11:00:00Z" }],
        hasMore: false,
        nextCursor: null,
      }),
    ).toThrow("ordenação");
    expect(() => parseMessagePage({ ...messagePage, extra: true })).toThrow("Contrato");
  });

  it.each([
    null,
    [],
    { ...messagePage, items: "invalid" },
    { ...messagePage, hasMore: "yes" },
    { ...messagePage, nextCursor: "" },
    { ...messagePage, items: [{ ...message, body: null }] },
    { ...messagePage, hasMore: false, nextCursor: "cursor" },
  ])("rejeita estrutura de página inválida %#", (invalid) => {
    expect(() => parseMessagePage(invalid)).toThrow("Contrato");
  });

  it.each([
    null,
    [],
    { conversationId: "conversation-1", lastReadAt: "2026-08-14T13:00:00Z" },
    {
      conversationId: "conversation-1",
      lastReadAt: "2026-08-14T13:00:00Z",
      unreadCount: 0,
      extra: true,
    },
    { conversationId: "", lastReadAt: "2026-08-14T13:00:00Z", unreadCount: 0 },
    { conversationId: "conversation-1", lastReadAt: "hoje", unreadCount: 0 },
    { conversationId: "conversation-1", lastReadAt: "2026-08-14T13:00:00Z", unreadCount: 1 },
  ])("rejeita leitura inválida %#", (invalid) => {
    expect(() => parseReadOutput(invalid)).toThrow("Contrato");
  });
});
