import { and, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { notificationPreferences } from "@/infrastructure/database/schema";
import { NotificationPreference } from "@/modules/notifications/domain/entities/notification-preference";
import type { NotificationEventType } from "@/modules/notifications/domain/notification-event";
import type { NotificationPreferenceRepository } from "@/modules/notifications/domain/repositories/notification-preference-repository";
import { requireRow } from "@/shared/utils/require-row";

type Row = typeof notificationPreferences.$inferSelect;
const toEntity = (row: Row) =>
  NotificationPreference.restore({
    ...row,
    eventType: row.eventType as NotificationEventType,
  });

export class DrizzleNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(private readonly db: Database) {}

  async list(userId: string, companyId: string): Promise<NotificationPreference[]> {
    return (
      await this.db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.companyId, companyId),
          ),
        )
    ).map(toEntity);
  }

  async find(
    userId: string,
    companyId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationPreference | null> {
    const row = (
      await this.db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.companyId, companyId),
            eq(notificationPreferences.eventType, eventType),
          ),
        )
    )[0];
    return row ? toEntity(row) : null;
  }

  async upsert(preference: NotificationPreference): Promise<NotificationPreference> {
    const values = {
      id: preference.id,
      userId: preference.userId,
      companyId: preference.companyId,
      eventType: preference.eventType,
      inAppEnabled: preference.inAppEnabled,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
    const rows = await this.db
      .insert(notificationPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: [
          notificationPreferences.userId,
          notificationPreferences.companyId,
          notificationPreferences.eventType,
        ],
        set: { inAppEnabled: preference.inAppEnabled, updatedAt: preference.updatedAt },
      })
      .returning();
    return toEntity(requireRow(rows[0]));
  }
}
