import type { NotificationEventType } from "@/modules/notifications/domain/notification-event";
import type { NotificationPreferenceRepository } from "@/modules/notifications/domain/repositories/notification-preference-repository";

export class PreferenceResolver {
  constructor(private readonly preferences: NotificationPreferenceRepository) {}

  async isEnabled(
    userId: string,
    companyId: string,
    eventType: NotificationEventType,
  ): Promise<boolean> {
    return (await this.preferences.find(userId, companyId, eventType))?.inAppEnabled ?? true;
  }
}
