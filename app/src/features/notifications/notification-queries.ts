import { useQuery } from "@tanstack/react-query";
import { notificationClient } from "./notification-client";
import { notificationKeys } from "./notification-keys";

export function useNotifications(companyId: string | null, panelOpen: boolean) {
  const enabled = Boolean(companyId && panelOpen);
  return useQuery({
    queryKey: notificationKeys.list(companyId ?? "disabled"),
    queryFn: ({ signal }) => notificationClient.list(companyId as string, { signal }),
    enabled,
  });
}

export function useNotificationPreferences(companyId: string | null, panelOpen: boolean) {
  const enabled = Boolean(companyId && panelOpen);
  return useQuery({
    queryKey: notificationKeys.preferences(companyId ?? "disabled"),
    queryFn: ({ signal }) => notificationClient.preferences(companyId as string, { signal }),
    enabled,
  });
}
