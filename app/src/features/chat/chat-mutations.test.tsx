import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { chatClient } from "./chat-client";
import { chatKeys } from "./chat-keys";
import { useCreateConversation, useMarkConversationRead, useSendMessage } from "./chat-mutations";
import { conversation, message } from "./chat-test-fixtures";

function wrapper(client: ReturnType<typeof createQueryClient>) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("chat mutations", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("bloqueia duplicata, não faz optimistic update e refaz lista e mensagens", async () => {
    const client = createQueryClient();
    const cached = { pages: [{ items: [] }], pageParams: [null] };
    client.setQueryData(chatKeys.messages("company-a", "conversation-1"), cached);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const refetch = vi.spyOn(client, "refetchQueries");
    let resolve: (value: typeof message) => void = () => undefined;
    vi.spyOn(chatClient, "sendMessage").mockImplementation(
      () => new Promise((done) => (resolve = done)),
    );
    const { result } = renderHook(() => useSendMessage("company-a", "conversation-1"), {
      wrapper: wrapper(client),
    });
    act(() => {
      expect(result.current.send("Olá")).toBe(true);
      expect(result.current.send("Duplicada")).toBe(false);
    });
    expect(client.getQueryData(chatKeys.messages("company-a", "conversation-1"))).toEqual(cached);
    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(chatClient.sendMessage).toHaveBeenCalledWith("company-a", "conversation-1", "Olá", {
      signal: expect.any(AbortSignal),
    });
    act(() => resolve(message));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: chatKeys.conversations("company-a"),
      exact: true,
      refetchType: "none",
    });
    expect(refetch).toHaveBeenCalledWith({
      queryKey: chatKeys.messages("company-a", "conversation-1"),
      exact: true,
      type: "active",
    });
  });

  it("bloqueia sem contexto e aborta request pendente ao desmontar", async () => {
    let signal: AbortSignal | null | undefined;
    vi.spyOn(chatClient, "sendMessage").mockImplementation((_companyId, _id, _body, options) => {
      signal = options?.signal;
      return new Promise(() => undefined);
    });
    const client = createQueryClient();
    const absent = renderHook(() => useSendMessage(null, null), { wrapper: wrapper(client) });
    expect(absent.result.current.send("Olá")).toBe(false);
    const present = renderHook(() => useSendMessage("company-a", "conversation-1"), {
      wrapper: wrapper(client),
    });
    act(() => expect(present.result.current.send("Olá")).toBe(true));
    await waitFor(() => expect(signal).toBeDefined());
    present.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("aborta a mutation do tenant anterior e ignora seus efeitos stale", async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let firstSignal: AbortSignal | null | undefined;
    let resolveFirst: (value: typeof message) => void = () => undefined;
    vi.spyOn(chatClient, "sendMessage").mockImplementation(
      (companyId, _conversationId, _body, options) => {
        if (companyId === "company-a") {
          firstSignal = options?.signal;
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve({ ...message, body: "Tenant B" });
      },
    );
    const { result, rerender } = renderHook(
      ({ companyId }) => useSendMessage(companyId, "conversation-1"),
      { initialProps: { companyId: "company-a" }, wrapper: wrapper(client) },
    );
    act(() => expect(result.current.send("Tenant A")).toBe(true));
    await waitFor(() => expect(firstSignal).toBeDefined());
    rerender({ companyId: "company-b" });
    expect(firstSignal?.aborted).toBe(true);
    act(() => expect(result.current.send("Tenant B")).toBe(true));
    await waitFor(() => expect(chatClient.sendMessage).toHaveBeenCalledTimes(2));

    act(() => resolveFirst(message));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: chatKeys.conversations("company-a"),
      exact: true,
      refetchType: "none",
    });
    expect(chatClient.sendMessage).toHaveBeenLastCalledWith(
      "company-b",
      "conversation-1",
      "Tenant B",
      { signal: expect.any(AbortSignal) },
    );
  });

  it("expõe erro de envio sem invalidar caches e permite nova tentativa", async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.spyOn(chatClient, "sendMessage")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(message);
    const { result } = renderHook(() => useSendMessage("company-a", "conversation-1"), {
      wrapper: wrapper(client),
    });
    act(() => expect(result.current.send("Primeira")).toBe(true));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
    act(() => expect(result.current.send("Segunda")).toBe(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(chatClient.sendMessage).toHaveBeenLastCalledWith(
      "company-a",
      "conversation-1",
      "Segunda",
      { signal: expect.any(AbortSignal) },
    );
  });

  it("cria conversa sem optimistic update e refaz somente a lista do tenant", async () => {
    const client = createQueryClient();
    const cached = { items: [] };
    client.setQueryData(chatKeys.conversations("company-a"), cached);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const refetch = vi.spyOn(client, "refetchQueries");
    vi.spyOn(chatClient, "createConversation").mockResolvedValue(conversation);
    const { result } = renderHook(() => useCreateConversation("company-a"), {
      wrapper: wrapper(client),
    });
    act(() => expect(result.current.create("participant-a")).toBe(true));
    expect(client.getQueryData(chatKeys.conversations("company-a"))).toBe(cached);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(chatClient.createConversation).toHaveBeenCalledWith("company-a", "participant-a", {
      signal: expect.any(AbortSignal),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: chatKeys.conversations("company-a"),
      exact: true,
      refetchType: "none",
    });
    expect(refetch).toHaveBeenCalledWith({
      queryKey: chatKeys.conversations("company-a"),
      exact: true,
      type: "active",
    });
  });

  it("bloqueia criação sem tenant/duplicada, preserva erro e aborta no unmount", async () => {
    let signal: AbortSignal | null | undefined;
    vi.spyOn(chatClient, "createConversation")
      .mockRejectedValueOnce(new Error("forbidden"))
      .mockImplementationOnce((_companyId, _participantId, options) => {
        signal = options?.signal;
        return new Promise(() => undefined);
      });
    const client = createQueryClient();
    const absent = renderHook(() => useCreateConversation(null), { wrapper: wrapper(client) });
    expect(absent.result.current.create("participant-a")).toBe(false);
    const present = renderHook(() => useCreateConversation("company-a"), {
      wrapper: wrapper(client),
    });
    act(() => expect(present.result.current.create("participant-a")).toBe(true));
    await waitFor(() => expect(present.result.current.isError).toBe(true));
    act(() => {
      expect(present.result.current.create("participant-a")).toBe(true);
      expect(present.result.current.create("participant-b")).toBe(false);
    });
    await waitFor(() => expect(signal).toBeDefined());
    present.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("aborta criação ao trocar tenant e ignora invalidação stale", async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let signal: AbortSignal | null | undefined;
    let resolve: (value: typeof conversation) => void = () => undefined;
    vi.spyOn(chatClient, "createConversation").mockImplementation(
      (_companyId, _participantId, options) => {
        signal = options?.signal;
        return new Promise((done) => {
          resolve = done;
        });
      },
    );
    const { result, rerender } = renderHook(({ tenant }) => useCreateConversation(tenant), {
      initialProps: { tenant: "company-a" },
      wrapper: wrapper(client),
    });
    act(() => expect(result.current.create("participant-a")).toBe(true));
    await waitFor(() => expect(signal).toBeDefined());
    rerender({ tenant: "company-b" });
    expect(signal?.aborted).toBe(true);
    act(() => resolve(conversation));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("marca leitura e refaz a lista canônica do tenant", async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const refetch = vi.spyOn(client, "refetchQueries");
    vi.spyOn(chatClient, "markRead").mockResolvedValue({
      conversationId: "conversation-1",
      lastReadAt: "2026-08-14T13:00:00Z",
      unreadCount: 0,
    });
    const { result } = renderHook(() => useMarkConversationRead("company-a"), {
      wrapper: wrapper(client),
    });
    act(() => expect(result.current.markRead("conversation-1")).toBe(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(chatClient.markRead).toHaveBeenCalledWith("company-a", "conversation-1", {
      signal: expect.any(AbortSignal),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: chatKeys.conversations("company-a"),
      exact: true,
      refetchType: "none",
    });
    expect(refetch).toHaveBeenCalledWith({
      queryKey: chatKeys.conversations("company-a"),
      exact: true,
      type: "active",
    });
  });

  it("bloqueia leitura sem tenant/duplicada, não invalida no erro e aborta no unmount", async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let signal: AbortSignal | null | undefined;
    vi.spyOn(chatClient, "markRead")
      .mockRejectedValueOnce(new Error("forbidden"))
      .mockImplementationOnce((_companyId, _conversationId, options) => {
        signal = options?.signal;
        return new Promise(() => undefined);
      });
    const absent = renderHook(() => useMarkConversationRead(null), { wrapper: wrapper(client) });
    expect(absent.result.current.markRead("conversation-1")).toBe(false);
    const present = renderHook(() => useMarkConversationRead("company-a"), {
      wrapper: wrapper(client),
    });
    act(() => expect(present.result.current.markRead("conversation-1")).toBe(true));
    await waitFor(() => expect(present.result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
    act(() => {
      expect(present.result.current.markRead("conversation-1")).toBe(true);
      expect(present.result.current.markRead("conversation-2")).toBe(false);
    });
    await waitFor(() => expect(signal).toBeDefined());
    present.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("aborta leitura ao trocar tenant e não invalida resposta stale", async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let signal: AbortSignal | null | undefined;
    let resolve: (value: { conversationId: string; lastReadAt: string; unreadCount: 0 }) => void =
      () => undefined;
    vi.spyOn(chatClient, "markRead").mockImplementation((_companyId, _conversationId, options) => {
      signal = options?.signal;
      return new Promise((done) => {
        resolve = done;
      });
    });
    const { result, rerender } = renderHook(({ tenant }) => useMarkConversationRead(tenant), {
      initialProps: { tenant: "company-a" },
      wrapper: wrapper(client),
    });
    act(() => expect(result.current.markRead("conversation-1")).toBe(true));
    await waitFor(() => expect(signal).toBeDefined());
    rerender({ tenant: "company-b" });
    expect(signal?.aborted).toBe(true);
    act(() =>
      resolve({
        conversationId: "conversation-1",
        lastReadAt: "2026-08-14T13:00:00Z",
        unreadCount: 0,
      }),
    );
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
