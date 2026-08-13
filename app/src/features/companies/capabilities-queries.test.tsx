import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { capabilitiesClient } from "./capabilities-client";
import { capabilitiesKeys } from "./capabilities-keys";
import { useCompanyCapabilities } from "./capabilities-queries";

describe("useCompanyCapabilities", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("usa key tenant-aware e passa AbortSignal ao client", async () => {
    const client = createQueryClient();
    const request = vi.spyOn(capabilitiesClient, "get").mockResolvedValue({
      companyId: "company-a",
      capabilities: {
        "tasks.create": true,
        "tasks.update": true,
        "kanban.manage": false,
        "users.read": false,
        "requisitions.read": false,
      },
    });
    const { result } = renderHook(() => useCompanyCapabilities("company-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledWith("company-a", { signal: expect.any(AbortSignal) });
    expect(client.getQueryData(capabilitiesKeys.company("company-a"))).toBeDefined();
    expect(client.getQueryData(capabilitiesKeys.company("company-b"))).toBeUndefined();
  });

  it("fica desabilitada sem empresa ativa", () => {
    const client = createQueryClient();
    const request = vi.spyOn(capabilitiesClient, "get");
    const { result } = renderHook(() => useCompanyCapabilities(null), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(request).not.toHaveBeenCalled();
  });
});
