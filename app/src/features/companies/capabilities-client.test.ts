import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { capabilitiesClient } from "./capabilities-client";
import { COMPANY_CAPABILITY_NAMES } from "./capabilities-contracts";

const capabilities = () =>
  Object.fromEntries(COMPANY_CAPABILITY_NAMES.map((name) => [name, false]));

describe("capabilitiesClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("consulta capabilities com companyId codificado e AbortSignal", async () => {
    const signal = new AbortController().signal;
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({
      companyId: "company-a",
      capabilities: { ...capabilities(), "tasks.create": true },
    });

    await expect(capabilitiesClient.get("company/a", { signal })).resolves.toMatchObject({
      companyId: "company-a",
    });
    expect(request).toHaveBeenCalledWith("/companies/company%2Fa/capabilities", { signal });
  });

  it("rejeita resposta fora do contrato", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue({ companyId: "company-a", capabilities: {} });

    await expect(capabilitiesClient.get("company-a")).rejects.toThrow(
      "Contrato de capabilities inválido",
    );
  });

  it("rejeita capability inesperada", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue({
      companyId: "company-a",
      capabilities: { ...capabilities(), "unexpected.permission": true },
    });

    await expect(capabilitiesClient.get("company-a")).rejects.toThrow(
      "Contrato de capabilities inválido",
    );
  });
});
