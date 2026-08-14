import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { chatClient } from "./chat-client";
import { chatKeys } from "./chat-keys";

interface BaseVariables {
  companyId: string;
  signal: AbortSignal;
}

interface CreateVariables extends BaseVariables {
  participantId: string;
}

interface ConversationVariables extends BaseVariables {
  conversationId: string;
}

interface SendVariables extends ConversationVariables {
  body: string;
}

export function useCreateConversation(companyId: string | null) {
  const queryClient = useQueryClient();
  const controller = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationKey: ["chat", "create-conversation"],
    mutationFn: ({ companyId: tenant, participantId, signal }: CreateVariables) =>
      chatClient.createConversation(tenant, participantId, { signal }),
    onSuccess: async (_conversation, variables) => {
      if (variables.signal.aborted) return;
      await refresh(queryClient, chatKeys.conversations(variables.companyId), variables.signal);
    },
    onSettled: (_data, _error, variables) => {
      if (controller.current?.signal === variables.signal) controller.current = null;
    },
  });
  useEffect(() => {
    if (!companyId) return;
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, [companyId]);

  function create(participantId: string): boolean {
    if (!companyId || controller.current) return false;
    const request = new AbortController();
    controller.current = request;
    mutation.mutate({ companyId, participantId, signal: request.signal });
    return true;
  }
  return { ...mutation, create };
}

export function useSendMessage(companyId: string | null, conversationId: string | null) {
  const queryClient = useQueryClient();
  const controller = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationKey: ["chat", "send-message"],
    mutationFn: ({ companyId: tenant, conversationId: id, body, signal }: SendVariables) =>
      chatClient.sendMessage(tenant, id, body, { signal }),
    onSuccess: async (_message, variables) => {
      if (variables.signal.aborted) return;
      await refresh(queryClient, chatKeys.conversations(variables.companyId), variables.signal);
      await refresh(
        queryClient,
        chatKeys.messages(variables.companyId, variables.conversationId),
        variables.signal,
      );
    },
    onSettled: (_data, _error, variables) => {
      if (controller.current?.signal === variables.signal) controller.current = null;
    },
  });
  useEffect(() => {
    if (!companyId || !conversationId) return;
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, [companyId, conversationId]);

  function send(body: string): boolean {
    if (!companyId || !conversationId || controller.current) return false;
    const request = new AbortController();
    controller.current = request;
    mutation.mutate({ companyId, conversationId, body, signal: request.signal });
    return true;
  }
  return { ...mutation, send };
}

export function useMarkConversationRead(companyId: string | null) {
  const queryClient = useQueryClient();
  const controller = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationKey: ["chat", "mark-read"],
    mutationFn: ({ companyId: tenant, conversationId, signal }: ConversationVariables) =>
      chatClient.markRead(tenant, conversationId, { signal }),
    onSuccess: async (_read, variables) => {
      if (variables.signal.aborted) return;
      await refresh(queryClient, chatKeys.conversations(variables.companyId), variables.signal);
    },
    onSettled: (_data, _error, variables) => {
      if (controller.current?.signal === variables.signal) controller.current = null;
    },
  });
  useEffect(() => {
    if (!companyId) return;
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, [companyId]);

  function markRead(conversationId: string): boolean {
    if (!companyId || controller.current) return false;
    const request = new AbortController();
    controller.current = request;
    mutation.mutate({ companyId, conversationId, signal: request.signal });
    return true;
  }
  return { ...mutation, markRead };
}

async function refresh(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  signal: AbortSignal,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
  if (!signal.aborted) {
    await queryClient.refetchQueries({ queryKey, exact: true, type: "active" });
  }
}
