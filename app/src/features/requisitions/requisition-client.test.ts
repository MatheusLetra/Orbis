import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { requisitionsClient } from "./requisition-client";
import { requisitionKeys } from "./requisition-keys";

describe("requisitions client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("envia filtros relevantes e preserva encoding de search", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await requisitionsClient.list("company-a", {
      status: "OPEN",
      priority: "HIGH",
      responsibleId: "user-a",
      search: "  RQ 10/20  ",
    });
    expect(request).toHaveBeenCalledWith(
      "/companies/company-a/requisitions?status=OPEN&priority=HIGH&responsibleId=user-a&search=RQ+10%2F20",
      undefined,
    );
  });

  it("repassa cancelamento e segrega keys por tenant", async () => {
    const signal = new AbortController().signal;
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await requisitionsClient.list("company-a", {}, { signal });
    expect(request).toHaveBeenCalledWith("/companies/company-a/requisitions", { signal });
    expect(requisitionKeys.list("company-a")).not.toEqual(requisitionKeys.list("company-b"));
  });
});
