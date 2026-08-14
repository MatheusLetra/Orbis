import { describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { yearlyTimelineClient } from "./yearly-client";

describe("yearlyTimelineClient", () => {
  it("envia ano e filtros codificados", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue({
      companyId: "c",
      year: "2026",
      months: Array.from({ length: 12 }, (_, index) => ({
        period: `2026-${String(index + 1).padStart(2, "0")}`,
        requisitionCount: 0,
        countsByPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 },
        estimatedHours: 0,
        deliveredOnTime: 0,
        overdue: 0,
        items: [],
        undatedItems: [],
      })),
      indicators: { totalRequisitions: 0, estimatedHours: 0, deliveredOnTime: 0, overdue: 0 },
    });
    await yearlyTimelineClient.list("company/a", "2026", { status: "DONE", priority: "HIGH" });
    expect(apiClient.request).toHaveBeenCalledWith(
      "/companies/company%2Fa/timeline/yearly?year=2026&priority=HIGH&status=DONE",
      undefined,
    );
  });
});
