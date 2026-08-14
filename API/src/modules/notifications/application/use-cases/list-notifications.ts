import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import {
  listNotificationsSchema,
  toNotificationOutput,
} from "@/modules/notifications/application/dto/notification-dtos";
import type { NotificationRepository } from "@/modules/notifications/domain/repositories/notification-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ValidationError } from "@/shared/errors/typed-errors";

export class ListNotifications {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly access: MembershipAccessService,
  ) {}

  async execute(input: { actor: AuthenticatedUser; limit?: number }) {
    await this.access.assertAccess(input.actor.userId, input.actor.companyId);
    const parsed = listNotificationsSchema.safeParse({ limit: input.limit });
    if (!parsed.success)
      throw new ValidationError("Limite inválido", { details: { issues: parsed.error.issues } });
    const page = await this.repository.list(
      input.actor.companyId,
      input.actor.userId,
      parsed.data.limit,
    );
    return { ...page, items: page.items.map(toNotificationOutput) };
  }
}
