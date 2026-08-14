import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { notificationClient } from "./notification-client";
import { notificationKeys } from "./notification-keys";
import { useMarkNotificationRead, useUpdateNotificationPreference } from "./notification-mutations";
import {
  notificationItem,
  notificationPreferences,
  notificationsPage,
} from "./notification-test-fixtures";

function wrapper(client: ReturnType<typeof createQueryClient>) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("notification mutations", () => {
  it("marca como lida sem optimistic update e invalida/refaz somente a lista exata", async () => {
    const client = createQueryClient();
    client.setQueryData(notificationKeys.list("company-a"), notificationsPage);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const refetch = vi.spyOn(client, "refetchQueries");
    vi.spyOn(notificationClient, "markRead").mockResolvedValue({
      ...notificationItem,
      readAt: "2026-08-14T13:00:00Z",
    });
    const { result } = renderHook(() => useMarkNotificationRead("company-a"), {
      wrapper: wrapper(client),
    });
    act(() => expect(result.current.markRead("notification-1")).toBe(true));
    expect(client.getQueryData(notificationKeys.list("company-a"))).toEqual(notificationsPage);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notificationClient.markRead).toHaveBeenCalledWith("company-a", "notification-1", {
      signal: expect.any(AbortSignal),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: notificationKeys.list("company-a"),
      exact: true,
      refetchType: "none",
    });
    expect(refetch).toHaveBeenCalledWith({
      queryKey: notificationKeys.list("company-a"),
      exact: true,
      type: "active",
    });
  });

  it("atualiza preferência sem optimistic update e busca estado canônico", async () => {
    const client = createQueryClient();
    client.setQueryData(notificationKeys.preferences("company-a"), notificationPreferences);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const refetch = vi.spyOn(client, "refetchQueries");
    vi.spyOn(notificationClient, "updatePreference").mockResolvedValue({
      eventType: "TASK_ASSIGNED",
      inAppEnabled: false,
    });
    const { result } = renderHook(() => useUpdateNotificationPreference("company-a"), {
      wrapper: wrapper(client),
    });
    act(() => expect(result.current.update("TASK_ASSIGNED", false)).toBe(true));
    expect(client.getQueryData(notificationKeys.preferences("company-a"))).toEqual(
      notificationPreferences,
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: notificationKeys.preferences("company-a"),
      exact: true,
      refetchType: "none",
    });
    expect(refetch).toHaveBeenCalledWith({
      queryKey: notificationKeys.preferences("company-a"),
      exact: true,
      type: "active",
    });
  });

  it("bloqueia sem tenant/duplicidade e aborta ao desmontar", async () => {
    let signal: AbortSignal | null | undefined;
    vi.spyOn(notificationClient, "markRead").mockImplementation(
      (_companyId, _notificationId, options) => {
        signal = options?.signal;
        return new Promise(() => undefined);
      },
    );
    const client = createQueryClient();
    const absent = renderHook(() => useMarkNotificationRead(null), { wrapper: wrapper(client) });
    expect(absent.result.current.markRead("notification-1")).toBe(false);
    const present = renderHook(() => useMarkNotificationRead("company-a"), {
      wrapper: wrapper(client),
    });
    act(() => {
      expect(present.result.current.markRead("notification-1")).toBe(true);
      expect(present.result.current.markRead("notification-2")).toBe(false);
    });
    await waitFor(() => expect(signal).toBeDefined());
    present.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
