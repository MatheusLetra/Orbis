import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { membersClient } from "./members-client";
import { memberKeys } from "./members-keys";

describe("members client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("envia companyId e search trimado, omitindo busca vazia", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await membersClient.list("company/a", { search: "  Ana & Bia  " });
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/members?search=Ana+%26+Bia",
      undefined,
    );
    await membersClient.list("company-a", { search: "   " });
    expect(request).toHaveBeenLastCalledWith("/companies/company-a/members", undefined);
  });

  it("mantém empresa e filtro na key", () => {
    expect(memberKeys.list("a", { search: "ana" })).not.toEqual(
      memberKeys.list("b", { search: "ana" }),
    );
  });

  it("repassa AbortSignal", async () => {
    const signal = new AbortController().signal;
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await membersClient.list("company-a", {}, { signal });
    expect(request).toHaveBeenCalledWith("/companies/company-a/members", { signal });
  });
});
