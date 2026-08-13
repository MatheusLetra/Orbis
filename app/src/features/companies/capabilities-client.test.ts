import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { capabilitiesClient } from "./capabilities-client";

describe("capabilitiesClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("consulta capabilities com companyId codificado e AbortSignal", async () => {
    const signal = new AbortController().signal;
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({
      companyId: "company-a",
      capabilities: {
        "tasks.create": true,
        "tasks.update": false,
        "kanban.manage": false,
        "hours.register": true,
        "users.read": true,
        "requisitions.read": false,
      },
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
      capabilities: {
        "tasks.create": false,
        "tasks.update": false,
        "kanban.manage": false,
        "hours.register": false,
        "users.read": false,
        "requisitions.read": false,
        "unexpected.permission": true,
      },
    });

    await expect(capabilitiesClient.get("company-a")).rejects.toThrow(
      "Contrato de capabilities inválido",
    );
  });
});
