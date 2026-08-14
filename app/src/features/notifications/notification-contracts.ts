export const NOTIFICATION_EVENT_TYPES = [
  "TASK_ASSIGNED",
  "TASK_STATUS_CHANGED",
  "REQUISITION_ASSIGNED",
  "REQUISITION_COMPLETED",
  "RELEASE_PUBLISHED",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export interface NotificationItem {
  id: string;
  companyId: string;
  userId: string;
  type: NotificationEventType;
  title: string;
  body: string | null;
  readAt: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationsPage {
  items: NotificationItem[];
  unreadCount: number;
  hasMore: boolean;
}

export interface NotificationPreference {
  eventType: NotificationEventType;
  inAppEnabled: boolean;
}

export interface NotificationPreferences {
  items: NotificationPreference[];
}

export function parseNotificationItem(value: unknown): NotificationItem {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "companyId",
      "userId",
      "type",
      "title",
      "body",
      "readAt",
      "data",
      "createdAt",
    ]) ||
    typeof value.id !== "string" ||
    typeof value.companyId !== "string" ||
    typeof value.userId !== "string" ||
    !isEventType(value.type) ||
    typeof value.title !== "string" ||
    !(typeof value.body === "string" || value.body === null) ||
    !(value.readAt === null || isIsoInstant(value.readAt)) ||
    !(value.data === null || isRecord(value.data)) ||
    !isIsoInstant(value.createdAt)
  ) {
    return invalid("notificação");
  }
  return value as unknown as NotificationItem;
}

export function parseNotificationsPage(value: unknown): NotificationsPage {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["items", "unreadCount", "hasMore"]) ||
    !Array.isArray(value.items) ||
    !Number.isSafeInteger(value.unreadCount) ||
    (value.unreadCount as number) < 0 ||
    typeof value.hasMore !== "boolean"
  ) {
    return invalid("lista de notificações");
  }
  const items = value.items.map(parseNotificationItem);
  if ((value.unreadCount as number) < items.filter((item) => item.readAt === null).length) {
    return invalid("lista de notificações");
  }
  return { items, unreadCount: value.unreadCount as number, hasMore: value.hasMore };
}

export function parseNotificationPreference(value: unknown): NotificationPreference {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["eventType", "inAppEnabled"]) ||
    !isEventType(value.eventType) ||
    typeof value.inAppEnabled !== "boolean"
  ) {
    return invalid("preferência de notificação");
  }
  return value as unknown as NotificationPreference;
}

export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  if (!isRecord(value) || !hasExactKeys(value, ["items"]) || !Array.isArray(value.items)) {
    return invalid("preferências de notificação");
  }
  const items = value.items.map(parseNotificationPreference);
  if (new Set(items.map((item) => item.eventType)).size !== items.length) {
    return invalid("preferências de notificação");
  }
  return { items };
}

function isEventType(value: unknown): value is NotificationEventType {
  return NOTIFICATION_EVENT_TYPES.includes(value as NotificationEventType);
}

function isIsoInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => expected.has(key))
  );
}

function invalid(contract: string): never {
  throw new Error(`Contrato de ${contract} inválido`);
}
