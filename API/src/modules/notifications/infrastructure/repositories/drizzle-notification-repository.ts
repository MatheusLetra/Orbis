import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { notifications } from "@/infrastructure/database/schema";
import { Notification } from "@/modules/notifications/domain/entities/notification";
import type { NotificationEventType } from "@/modules/notifications/domain/notification-event";
import type {
  NotificationPage,
  NotificationRepository,
} from "@/modules/notifications/domain/repositories/notification-repository";
import { requireRow } from "@/shared/utils/require-row";

type Row = typeof notifications.$inferSelect;
const toEntity = (row: Row) =>
  Notification.restore({
    ...row,
    type: row.type as NotificationEventType,
    data: row.data ?? null,
  });

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Database) {}

  async create(notification: Notification): Promise<Notification> {
    const rows = await this.db
      .insert(notifications)
      .values({
        id: notification.id,
        companyId: notification.companyId,
        userId: notification.userId,
        eventId: notification.eventId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        readAt: notification.readAt,
        data: notification.data,
        createdAt: notification.createdAt,
      })
      .onConflictDoNothing()
      .returning();
    return rows[0] ? toEntity(rows[0]) : notification;
  }

  async list(companyId: string, userId: string, limit: number): Promise<NotificationPage> {
    const where = and(eq(notifications.companyId, companyId), eq(notifications.userId, userId));
    const [rows, unreadRows] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(limit + 1),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(and(where, isNull(notifications.readAt))),
    ]);
    return {
      items: rows.slice(0, limit).map(toEntity),
      unreadCount: Number(unreadRows[0]?.value ?? 0),
      hasMore: rows.length > limit,
    };
  }

  async findById(companyId: string, userId: string, id: string): Promise<Notification | null> {
    const row = (
      await this.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.companyId, companyId),
            eq(notifications.userId, userId),
          ),
        )
    )[0];
    return row ? toEntity(row) : null;
  }

  async update(notification: Notification): Promise<Notification> {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: notification.readAt })
      .where(
        and(
          eq(notifications.id, notification.id),
          eq(notifications.companyId, notification.companyId),
          eq(notifications.userId, notification.userId),
        ),
      )
      .returning();
    return toEntity(requireRow(rows[0]));
  }
}
