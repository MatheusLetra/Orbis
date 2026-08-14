import type { NotificationEvent } from "@/modules/notifications/domain/notification-event";

export interface NotificationDispatcher {
  handle(event: NotificationEvent): Promise<void>;
}

export const NOOP_NOTIFICATION_DISPATCHER: NotificationDispatcher = { async handle() {} };
