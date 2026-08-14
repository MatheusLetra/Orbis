import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { toPreferenceOutput } from "@/modules/notifications/application/dto/notification-dtos";
import { NOTIFICATION_EVENT_TYPES } from "@/modules/notifications/domain/notification-event";
import type { NotificationPreferenceRepository } from "@/modules/notifications/domain/repositories/notification-preference-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";

export class GetNotificationPreferences {
  constructor(
    private readonly repository: NotificationPreferenceRepository,
    private readonly access: MembershipAccessService,
  ) {}

  async execute(input: { actor: AuthenticatedUser }) {
    await this.access.assertAccess(input.actor.userId, input.actor.companyId);
    const stored = await this.repository.list(input.actor.userId, input.actor.companyId);
    const byType = new Map(stored.map((item) => [item.eventType, item]));
    const items = NOTIFICATION_EVENT_TYPES.map((eventType) => {
      const preference = byType.get(eventType);
      return preference ? toPreferenceOutput(preference) : { eventType, inAppEnabled: true };
    });
    return { items };
  }
}
