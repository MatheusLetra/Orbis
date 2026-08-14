import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import {
  type NotificationEventType,
  parseNotificationItem,
  parseNotificationPreference,
  parseNotificationPreferences,
  parseNotificationsPage,
} from "./notification-contracts";

const LIMIT = 20;

export const notificationClient = {
  list(companyId: string, options?: Pick<RequestOptions, "signal">) {
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/notifications?limit=${LIMIT}`,
        options,
      )
      .then(parseNotificationsPage);
  },

  markRead(companyId: string, notificationId: string, options?: Pick<RequestOptions, "signal">) {
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/notifications/${encodeURIComponent(notificationId)}/read`,
        { ...options, method: "PATCH" },
      )
      .then(parseNotificationItem);
  },

  preferences(companyId: string, options?: Pick<RequestOptions, "signal">) {
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/notification-preferences`,
        options,
      )
      .then(parseNotificationPreferences);
  },

  updatePreference(
    companyId: string,
    input: { eventType: NotificationEventType; inAppEnabled: boolean },
    options?: Pick<RequestOptions, "signal">,
  ) {
    return apiClient
      .request<unknown>(`/companies/${encodeURIComponent(companyId)}/notification-preferences`, {
        ...options,
        method: "PATCH",
        body: { eventType: input.eventType, inAppEnabled: input.inAppEnabled },
      })
      .then(parseNotificationPreference);
  },
};
