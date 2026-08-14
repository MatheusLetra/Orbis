import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { chatClient } from "./chat-client";
import { orderedUniqueMessages, useConversations, useMessages } from "./chat-queries";
import { message, messagePage } from "./chat-test-fixtures";

function wrapper() {
  const client = createQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("chat queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("habilita lista apenas com tenant e mensagens apenas com tenant e conversa", () => {
    const list = vi.spyOn(chatClient, "listConversations");
    const messages = vi.spyOn(chatClient, "listMessages");
    const { result } = renderHook(
      () => ({ conversations: useConversations(null), messages: useMessages("company-a", null) }),
      { wrapper: wrapper() },
    );
    expect(result.current.conversations.fetchStatus).toBe("idle");
    expect(result.current.messages.fetchStatus).toBe("idle");
    expect(list).not.toHaveBeenCalled();
    expect(messages).not.toHaveBeenCalled();
  });

  it("consulta conversas com tenant e AbortSignal e aborta ao desmontar", async () => {
    let signal: AbortSignal | null | undefined;
    vi.spyOn(chatClient, "listConversations").mockImplementation((_companyId, options) => {
      signal = options?.signal;
      return new Promise(() => undefined);
    });
    const view = renderHook(() => useConversations("company-a"), { wrapper: wrapper() });
    await waitFor(() => expect(signal).toBeDefined());
    expect(chatClient.listConversations).toHaveBeenCalledWith("company-a", {
      signal: expect.any(AbortSignal),
    });
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("armazena a lista canônica no cache isolado pelo tenant", async () => {
    vi.spyOn(chatClient, "listConversations").mockResolvedValue({ items: [] });
    const { result } = renderHook(() => useConversations("company-a"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toEqual({ items: [] }));
    expect(result.current.isSuccess).toBe(true);
  });

  it("carrega páginas anteriores com cursor e AbortSignal", async () => {
    vi.spyOn(chatClient, "listMessages")
      .mockResolvedValueOnce({ ...messagePage, hasMore: true, nextCursor: "cursor-1" })
      .mockResolvedValueOnce({
        items: [{ ...message, id: "message-0", createdAt: "2026-08-14T11:00:00Z" }],
        hasMore: false,
        nextCursor: null,
      });
    const { result } = renderHook(() => useMessages("company-a", "conversation-1"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(chatClient.listMessages).toHaveBeenNthCalledWith(
      2,
      "company-a",
      "conversation-1",
      "cursor-1",
      { signal: expect.any(AbortSignal) },
    );
    expect(orderedUniqueMessages(result.current.data?.pages).map((item) => item.id)).toEqual([
      "message-0",
      "message-1",
    ]);
  });

  it("remove duplicatas e preserva ordenação canônica", () => {
    expect(
      orderedUniqueMessages([
        { items: [message] },
        { items: [{ ...message }, { ...message, id: "later", createdAt: "2026-08-14T13:00:00Z" }] },
      ]).map((item) => item.id),
    ).toEqual(["message-1", "later"]);
    expect(orderedUniqueMessages(undefined)).toEqual([]);
  });

  it("aborta o tenant anterior e não expõe sua resposta stale após a troca", async () => {
    let firstSignal: AbortSignal | null | undefined;
    let resolveFirst: (value: typeof messagePage) => void = () => undefined;
    vi.spyOn(chatClient, "listMessages").mockImplementation(
      (companyId, _conversationId, _before, options) => {
        if (companyId === "company-a") {
          firstSignal = options?.signal;
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve({
          ...messagePage,
          items: [{ ...message, id: "message-b", body: "Tenant B" }],
        });
      },
    );
    const { result, rerender } = renderHook(
      ({ companyId }) => useMessages(companyId, "conversation-1"),
      { initialProps: { companyId: "company-a" }, wrapper: wrapper() },
    );
    await waitFor(() => expect(firstSignal).toBeDefined());
    rerender({ companyId: "company-b" });
    expect(firstSignal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.data?.pages[0]?.items[0]?.body).toBe("Tenant B"));

    await act(() => resolveFirst(messagePage));
    expect(result.current.data?.pages[0]?.items[0]?.body).toBe("Tenant B");
    expect(chatClient.listMessages).toHaveBeenLastCalledWith("company-b", "conversation-1", null, {
      signal: expect.any(AbortSignal),
    });
  });
});
