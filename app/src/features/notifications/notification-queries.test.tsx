import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { notificationClient } from "./notification-client";
import { notificationKeys } from "./notification-keys";
import { useNotificationPreferences, useNotifications } from "./notification-queries";
import { notificationPreferences, notificationsPage } from "./notification-test-fixtures";

function wrapper(client = createQueryClient()) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("notification queries", () => {
  it.each([
    [null, true],
    ["company-a", false],
  ])("não consulta sem empresa ou painel aberto (%s, %s)", (companyId, open) => {
    const list = vi.spyOn(notificationClient, "list");
    const preferences = vi.spyOn(notificationClient, "preferences");
    const { result } = renderHook(
      () => ({
        list: useNotifications(companyId, open),
        preferences: useNotificationPreferences(companyId, open),
      }),
      { wrapper: wrapper() },
    );
    expect(result.current.list.fetchStatus).toBe("idle");
    expect(result.current.preferences.fetchStatus).toBe("idle");
    expect(list).not.toHaveBeenCalled();
    expect(preferences).not.toHaveBeenCalled();
  });

  it("consulta ao abrir com signal e caches tenant-aware", async () => {
    vi.spyOn(notificationClient, "list").mockResolvedValue(notificationsPage);
    vi.spyOn(notificationClient, "preferences").mockResolvedValue(notificationPreferences);
    const client = createQueryClient();
    const { result } = renderHook(
      () => ({
        list: useNotifications("company-a", true),
        preferences: useNotificationPreferences("company-a", true),
      }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.list.data).toEqual(notificationsPage));
    await waitFor(() => expect(result.current.preferences.data).toEqual(notificationPreferences));
    expect(notificationClient.list).toHaveBeenCalledWith("company-a", {
      signal: expect.any(AbortSignal),
    });
    expect(notificationClient.preferences).toHaveBeenCalledWith("company-a", {
      signal: expect.any(AbortSignal),
    });
    expect(client.getQueryData(notificationKeys.list("company-a"))).toEqual(notificationsPage);
    expect(client.getQueryData(notificationKeys.preferences("company-a"))).toEqual(
      notificationPreferences,
    );
  });

  it("aborta a consulta ao desmontar o painel", async () => {
    let signal: AbortSignal | null | undefined;
    vi.spyOn(notificationClient, "list").mockImplementation((_companyId, options) => {
      signal = options?.signal;
      return new Promise(() => undefined);
    });
    vi.spyOn(notificationClient, "preferences").mockImplementation(
      () => new Promise(() => undefined),
    );
    const view = renderHook(() => useNotifications("company-a", true), { wrapper: wrapper() });
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
