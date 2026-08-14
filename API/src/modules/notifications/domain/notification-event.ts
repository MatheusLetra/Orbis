export const NOTIFICATION_EVENT_TYPES = [
  "TASK_ASSIGNED",
  "TASK_STATUS_CHANGED",
  "REQUISITION_ASSIGNED",
  "REQUISITION_COMPLETED",
  "RELEASE_PUBLISHED",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export interface NotificationEvent {
  eventType: NotificationEventType;
  companyId: string;
  actorId: string;
  recipientIds?: readonly string[];
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  eventId?: string;
}
