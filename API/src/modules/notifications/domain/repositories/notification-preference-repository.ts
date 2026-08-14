import type { NotificationPreference } from "@/modules/notifications/domain/entities/notification-preference";
import type { NotificationEventType } from "@/modules/notifications/domain/notification-event";

export interface NotificationPreferenceRepository {
  list(userId: string, companyId: string): Promise<NotificationPreference[]>;
  find(
    userId: string,
    companyId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationPreference | null>;
  upsert(preference: NotificationPreference): Promise<NotificationPreference>;
}
