import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { notificationClient } from "./notification-client";
import { notificationPreferences, notificationsPage } from "./notification-test-fixtures";

describe("notificationClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("codifica IDs, limita a lista e repassa AbortSignal", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(notificationsPage);
    const signal = new AbortController().signal;
    await notificationClient.list("company/a", { signal });
    expect(request).toHaveBeenCalledWith("/companies/company%2Fa/notifications?limit=20", {
      signal,
    });
  });

  it("marca ID codificado como lido por PATCH", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({
      ...notificationsPage.items[0],
      readAt: "2026-08-14T13:00:00Z",
    });
    const signal = new AbortController().signal;
    await notificationClient.markRead("company/a", "notification/a", { signal });
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/notifications/notification%2Fa/read",
      { method: "PATCH", signal },
    );
  });

  it("consulta e atualiza preferências com body estrito", async () => {
    const request = vi
      .spyOn(apiClient, "request")
      .mockResolvedValueOnce(notificationPreferences)
      .mockResolvedValueOnce(notificationPreferences.items[0]);
    await notificationClient.preferences("company/a");
    await notificationClient.updatePreference("company/a", {
      eventType: "TASK_ASSIGNED",
      inAppEnabled: false,
    });
    expect(request).toHaveBeenNthCalledWith(
      1,
      "/companies/company%2Fa/notification-preferences",
      undefined,
    );
    expect(request).toHaveBeenNthCalledWith(2, "/companies/company%2Fa/notification-preferences", {
      method: "PATCH",
      body: { eventType: "TASK_ASSIGNED", inAppEnabled: false },
    });
  });

  it("rejeita payload de resposta inválido", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue({ ...notificationsPage, extra: true });
    await expect(notificationClient.list("company-a")).rejects.toThrow("Contrato");
  });
});
