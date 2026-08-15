import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { adminClient } from "./admin-client";
import {
  useAdminAction,
  useAdminAudit,
  useAdminCompanies,
  useAdminMembers,
  useAdminReleases,
  useAdminRequisition,
  useAdminRequisitions,
  useAdminSystems,
  useAdminVersions,
  useCapacitySettings,
} from "./admin-queries";

vi.mock("./admin-client", () => ({
  adminClient: {
    companies: vi.fn().mockResolvedValue([]),
    capacity: vi.fn().mockResolvedValue({ companyId: "company-a", dailyHoursPerDeveloper: null }),
    members: vi.fn().mockResolvedValue([]),
    requisitions: vi.fn().mockResolvedValue([]),
    requisition: vi.fn().mockResolvedValue({ id: "req-a" }),
    systems: vi.fn().mockResolvedValue([]),
    versions: vi.fn().mockResolvedValue([]),
    releases: vi.fn().mockResolvedValue([]),
    audit: vi
      .fn()
      .mockResolvedValue({ companyId: "company-a", items: [], hasMore: false, nextCursor: null }),
  },
}));

describe("admin queries", () => {
  it("executa consultas com chaves tenant-aware e invalida mutações", async () => {
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    );
    const hooks = [
      renderHook(() => useAdminCompanies("company-a"), { wrapper }),
      renderHook(() => useCapacitySettings("company-a"), { wrapper }),
      renderHook(() => useAdminMembers("company-a"), { wrapper }),
      renderHook(() => useAdminRequisitions("company-a", "status=OPEN"), { wrapper }),
      renderHook(() => useAdminRequisition("company-a", "req-a"), { wrapper }),
      renderHook(() => useAdminSystems("company-a"), { wrapper }),
      renderHook(() => useAdminVersions("company-a", "system-a"), { wrapper }),
      renderHook(() => useAdminReleases("company-a"), { wrapper }),
      renderHook(() => useAdminAudit("company-a", "limit=50"), { wrapper }),
    ];
    await waitFor(() => expect(hooks.every((hook) => hook.result.current.isSuccess)).toBe(true));
    expect(adminClient.audit).toHaveBeenCalledWith("company-a", "limit=50", expect.any(Object));

    const action = renderHook(() => useAdminAction("company-a"), { wrapper });
    action.result.current.mutate(() => Promise.resolve("ok"));
    await waitFor(() => expect(action.result.current.isSuccess).toBe(true));
  });

  it("mantém consultas desabilitadas sem tenant", () => {
    const cache = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    );
    expect(renderHook(() => useAdminCompanies(null), { wrapper }).result.current.fetchStatus).toBe(
      "idle",
    );
    expect(
      renderHook(() => useCapacitySettings(null), { wrapper }).result.current.fetchStatus,
    ).toBe("idle");
    expect(renderHook(() => useAdminMembers(null), { wrapper }).result.current.fetchStatus).toBe(
      "idle",
    );
    expect(
      renderHook(() => useAdminRequisitions(null, ""), { wrapper }).result.current.fetchStatus,
    ).toBe("idle");
    expect(
      renderHook(() => useAdminRequisition(null, null), { wrapper }).result.current.fetchStatus,
    ).toBe("idle");
    expect(renderHook(() => useAdminSystems(null), { wrapper }).result.current.fetchStatus).toBe(
      "idle",
    );
    expect(
      renderHook(() => useAdminVersions(null, null), { wrapper }).result.current.fetchStatus,
    ).toBe("idle");
    expect(renderHook(() => useAdminReleases(null), { wrapper }).result.current.fetchStatus).toBe(
      "idle",
    );
    expect(renderHook(() => useAdminAudit(null, ""), { wrapper }).result.current.fetchStatus).toBe(
      "idle",
    );
    expect(renderHook(() => useAdminAction(null), { wrapper }).result.current.isIdle).toBe(true);
  });
});
