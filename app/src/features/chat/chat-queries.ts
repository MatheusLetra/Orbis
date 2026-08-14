import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { chatClient, MESSAGE_LIMIT } from "./chat-client";
import type { MessageOutput } from "./chat-contracts";
import { chatKeys } from "./chat-keys";

const MANUAL_QUERY_OPTIONS = {
  staleTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: false,
} as const;

export function useConversations(companyId: string | null) {
  return useQuery({
    queryKey: chatKeys.conversations(companyId ?? "disabled"),
    queryFn: ({ signal }) => chatClient.listConversations(companyId as string, { signal }),
    enabled: Boolean(companyId),
    ...MANUAL_QUERY_OPTIONS,
  });
}

export function useMessages(companyId: string | null, conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(
      companyId ?? "disabled",
      conversationId ?? "disabled",
      MESSAGE_LIMIT,
    ),
    queryFn: ({ pageParam, signal }) =>
      chatClient.listMessages(companyId as string, conversationId as string, pageParam, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    getPreviousPageParam: () => undefined,
    enabled: Boolean(companyId && conversationId),
    ...MANUAL_QUERY_OPTIONS,
  });
}

export function orderedUniqueMessages(
  pages: ReadonlyArray<{ items: MessageOutput[] }> | undefined,
): MessageOutput[] {
  const byId = new Map<string, MessageOutput>();
  for (const page of pages ?? []) {
    for (const message of page.items) byId.set(message.id, message);
  }
  return [...byId.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
}
