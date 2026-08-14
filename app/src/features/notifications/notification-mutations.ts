import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { notificationClient } from "./notification-client";
import type { NotificationEventType } from "./notification-contracts";
import { notificationKeys } from "./notification-keys";

interface MarkReadVariables {
  companyId: string;
  notificationId: string;
  signal: AbortSignal;
}

interface PreferenceVariables {
  companyId: string;
  eventType: NotificationEventType;
  inAppEnabled: boolean;
  signal: AbortSignal;
}

export function useMarkNotificationRead(companyId: string | null) {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationKey: ["notifications", "mark-read"],
    mutationFn: ({ companyId: tenant, notificationId, signal }: MarkReadVariables) =>
      notificationClient.markRead(tenant, notificationId, { signal }),
    onSuccess: async (_item, variables) => {
      if (variables.signal.aborted) return;
      const queryKey = notificationKeys.list(variables.companyId);
      await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
      if (!variables.signal.aborted) {
        await queryClient.refetchQueries({ queryKey, exact: true, type: "active" });
      }
    },
    onSettled: (_data, _error, variables) => {
      if (controllerRef.current?.signal === variables.signal) controllerRef.current = null;
    },
  });

  useEffect(() => () => controllerRef.current?.abort(), []);

  function markRead(notificationId: string): boolean {
    if (!companyId || controllerRef.current) return false;
    const controller = new AbortController();
    controllerRef.current = controller;
    mutation.mutate({ companyId, notificationId, signal: controller.signal });
    return true;
  }

  return { ...mutation, markRead };
}

export function useUpdateNotificationPreference(companyId: string | null) {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationKey: ["notifications", "update-preference"],
    mutationFn: ({ companyId: tenant, eventType, inAppEnabled, signal }: PreferenceVariables) =>
      notificationClient.updatePreference(tenant, { eventType, inAppEnabled }, { signal }),
    onSuccess: async (_preference, variables) => {
      if (variables.signal.aborted) return;
      const queryKey = notificationKeys.preferences(variables.companyId);
      await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
      if (!variables.signal.aborted) {
        await queryClient.refetchQueries({ queryKey, exact: true, type: "active" });
      }
    },
    onSettled: (_data, _error, variables) => {
      if (controllerRef.current?.signal === variables.signal) controllerRef.current = null;
    },
  });

  useEffect(() => () => controllerRef.current?.abort(), []);

  function update(eventType: NotificationEventType, inAppEnabled: boolean): boolean {
    if (!companyId || controllerRef.current) return false;
    const controller = new AbortController();
    controllerRef.current = controller;
    mutation.mutate({ companyId, eventType, inAppEnabled, signal: controller.signal });
    return true;
  }

  return { ...mutation, update };
}
