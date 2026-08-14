import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { toNotificationOutput } from "@/modules/notifications/application/dto/notification-dtos";
import type { NotificationRepository } from "@/modules/notifications/domain/repositories/notification-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { NotFoundError } from "@/shared/errors/typed-errors";

export class MarkNotificationRead {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly access: MembershipAccessService,
  ) {}

  async execute(input: { actor: AuthenticatedUser; notificationId: string }) {
    await this.access.assertAccess(input.actor.userId, input.actor.companyId);
    const notification = await this.repository.findById(
      input.actor.companyId,
      input.actor.userId,
      input.notificationId,
    );
    if (!notification) throw new NotFoundError("Notificação não encontrada");
    if (notification.readAt === null) {
      notification.markRead();
      return toNotificationOutput(await this.repository.update(notification));
    }
    return toNotificationOutput(notification);
  }
}
