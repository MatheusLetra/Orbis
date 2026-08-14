import type { Notification } from "@/modules/notifications/domain/entities/notification";

export interface NotificationPage {
  items: Notification[];
  unreadCount: number;
  hasMore: boolean;
}

export interface NotificationRepository {
  create(notification: Notification): Promise<Notification>;
  list(companyId: string, userId: string, limit: number): Promise<NotificationPage>;
  findById(companyId: string, userId: string, id: string): Promise<Notification | null>;
  update(notification: Notification): Promise<Notification>;
}
