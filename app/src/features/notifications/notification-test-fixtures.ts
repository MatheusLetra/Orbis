import type {
  NotificationItem,
  NotificationPreference,
  NotificationPreferences,
  NotificationsPage,
} from "./notification-contracts";

export const notificationItem: NotificationItem = {
  id: "notification-1",
  companyId: "company-a",
  userId: "user-a",
  type: "TASK_ASSIGNED",
  title: "Nova tarefa atribuída",
  body: "Uma descrição suficientemente longa para validar conteúdo.",
  readAt: null,
  data: { taskId: "task-a" },
  createdAt: "2026-08-14T12:00:00.000Z",
};

export const taskAssignedPreference: NotificationPreference = {
  eventType: "TASK_ASSIGNED",
  inAppEnabled: true,
};

export const notificationsPage: NotificationsPage = {
  items: [notificationItem],
  unreadCount: 1,
  hasMore: false,
};

export const notificationPreferences: NotificationPreferences = {
  items: [taskAssignedPreference, { eventType: "RELEASE_PUBLISHED", inAppEnabled: false }],
};
