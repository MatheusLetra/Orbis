import { describe, expect, it } from "vitest";
import {
  parseNotificationItem,
  parseNotificationPreference,
  parseNotificationPreferences,
  parseNotificationsPage,
} from "./notification-contracts";
import { notificationPreferences, notificationsPage } from "./notification-test-fixtures";

describe("notification contracts", () => {
  it("aceita respostas estritas do backend", () => {
    expect(parseNotificationsPage(notificationsPage)).toEqual(notificationsPage);
    expect(parseNotificationItem(notificationsPage.items[0])).toEqual(notificationsPage.items[0]);
    expect(parseNotificationPreferences(notificationPreferences)).toEqual(notificationPreferences);
    expect(parseNotificationPreference(notificationPreferences.items[0])).toEqual(
      notificationPreferences.items[0],
    );
  });

  it.each([
    null,
    { ...notificationsPage, extra: true },
    { ...notificationsPage, unreadCount: -1 },
    { ...notificationsPage, unreadCount: 0 },
    { ...notificationsPage, hasMore: "false" },
    { ...notificationsPage, items: [{ ...notificationsPage.items[0], type: "UNKNOWN" }] },
    { ...notificationsPage, items: [{ ...notificationsPage.items[0], readAt: "hoje" }] },
    { ...notificationsPage, items: [{ ...notificationsPage.items[0], data: [] }] },
    { ...notificationsPage, items: [{ ...notificationsPage.items[0], unexpected: true }] },
  ])("rejeita lista inválida %#", (value) => {
    expect(() => parseNotificationsPage(value)).toThrow(/Contrato de .*notifica/);
  });

  it.each([
    { items: [{ eventType: "UNKNOWN", inAppEnabled: true }] },
    { items: [{ eventType: "TASK_ASSIGNED", inAppEnabled: "true" }] },
    {
      items: [
        { eventType: "TASK_ASSIGNED", inAppEnabled: true },
        { eventType: "TASK_ASSIGNED", inAppEnabled: false },
      ],
    },
    { items: [], extra: true },
  ])("rejeita preferências inválidas %#", (value) => {
    expect(() => parseNotificationPreferences(value)).toThrow(
      /Contrato de preferências? de notificação inválido/,
    );
  });
});
