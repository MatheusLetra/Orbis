import { describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { reportClient } from "./report-client";

const response = { companyId: "company", items: [], total: 0, page: 1, limit: 50, hasMore: false };
describe("cliente do relatório", () => {
  it("codifica tenant, filtros e página", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(response);
    await expect(reportClient.list("company/a", { status: "DONE" }, 2)).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/reports/tasks?status=DONE&page=2",
      undefined,
    );
  });
  it("repassa signal na exportação", async () => {
    const request = vi
      .spyOn(apiClient, "requestBlob")
      .mockResolvedValue({ blob: new Blob(), headers: new Headers() });
    const signal = new AbortController().signal;
    await reportClient.exportCsv("company", { priority: "HIGH" }, { signal });
    expect(request).toHaveBeenCalledWith("/companies/company/reports/tasks/export?priority=HIGH", {
      signal,
    });
  });
});
