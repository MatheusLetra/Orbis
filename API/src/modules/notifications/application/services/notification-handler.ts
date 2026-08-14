import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { NotificationDispatcher } from "@/modules/notifications/application/ports/notification-dispatcher";
import type { ReleaseRecipientResolver } from "@/modules/notifications/application/ports/release-recipient-resolver";
import type { PreferenceResolver } from "@/modules/notifications/application/services/preference-resolver";
import { Notification } from "@/modules/notifications/domain/entities/notification";
import type { NotificationEvent } from "@/modules/notifications/domain/notification-event";
import type { NotificationRepository } from "@/modules/notifications/domain/repositories/notification-repository";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";

export class NotificationHandler implements NotificationDispatcher {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
    private readonly preferenceResolver: PreferenceResolver,
    private readonly releaseRecipients: ReleaseRecipientResolver,
  ) {}

  async handle(event: NotificationEvent): Promise<void> {
    const requested =
      event.eventType === "RELEASE_PUBLISHED"
        ? await this.releaseRecipients.resolve(event.companyId)
        : [...(event.recipientIds ?? [])];
    const recipients = [...new Set(requested)].filter((id) => id !== event.actorId);

    for (const userId of recipients) {
      const [membership, user, enabled] = await Promise.all([
        this.memberships.findByUserAndCompany(userId, event.companyId),
        this.users.findById(userId),
        this.preferenceResolver.isEnabled(userId, event.companyId, event.eventType),
      ]);
      if (!membership?.isActive || !user?.isActive || !enabled) continue;
      await this.notifications.create(
        Notification.create({
          companyId: event.companyId,
          userId,
          eventId: event.eventId ?? null,
          type: event.eventType,
          title: event.title,
          body: event.body,
          data: event.data,
        }),
      );
    }
  }
}
