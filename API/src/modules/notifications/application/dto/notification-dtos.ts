import { z } from "zod";
import type { Notification } from "@/modules/notifications/domain/entities/notification";
import type { NotificationPreference } from "@/modules/notifications/domain/entities/notification-preference";
import { NOTIFICATION_EVENT_TYPES } from "@/modules/notifications/domain/notification-event";

export const listNotificationsSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
  .strict();
export const updatePreferenceSchema = z
  .object({
    eventType: z.enum(NOTIFICATION_EVENT_TYPES),
    inAppEnabled: z.boolean(),
  })
  .strict();

export const toNotificationOutput = (item: Notification) => ({
  id: item.id,
  companyId: item.companyId,
  userId: item.userId,
  type: item.type,
  title: item.title,
  body: item.body,
  readAt: item.readAt?.toISOString() ?? null,
  data: item.data,
  createdAt: item.createdAt.toISOString(),
});

export const toPreferenceOutput = (item: NotificationPreference) => ({
  eventType: item.eventType,
  inAppEnabled: item.inAppEnabled,
});
