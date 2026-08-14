import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import {
  toPreferenceOutput,
  updatePreferenceSchema,
} from "@/modules/notifications/application/dto/notification-dtos";
import { NotificationPreference } from "@/modules/notifications/domain/entities/notification-preference";
import type { NotificationPreferenceRepository } from "@/modules/notifications/domain/repositories/notification-preference-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ValidationError } from "@/shared/errors/typed-errors";

export class UpdateNotificationPreference {
  constructor(
    private readonly repository: NotificationPreferenceRepository,
    private readonly access: MembershipAccessService,
  ) {}

  async execute(input: { actor: AuthenticatedUser; data: unknown }) {
    await this.access.assertAccess(input.actor.userId, input.actor.companyId);
    const parsed = updatePreferenceSchema.safeParse(input.data);
    if (!parsed.success)
      throw new ValidationError("Preferência inválida", {
        details: { issues: parsed.error.issues },
      });
    const existing = await this.repository.find(
      input.actor.userId,
      input.actor.companyId,
      parsed.data.eventType,
    );
    const preference =
      existing ??
      NotificationPreference.create({
        userId: input.actor.userId,
        companyId: input.actor.companyId,
        eventType: parsed.data.eventType,
        inAppEnabled: parsed.data.inAppEnabled,
      });
    if (existing) preference.setInAppEnabled(parsed.data.inAppEnabled);
    return toPreferenceOutput(await this.repository.upsert(preference));
  }
}
