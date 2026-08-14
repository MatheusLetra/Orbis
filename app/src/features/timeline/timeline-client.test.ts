import { describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { timelineClient } from "./timeline-client";
import { weeklyTimeline } from "./timeline-test-fixtures";

describe("timelineClient", () => {
  it("codifica tenant, semana e filtros e repassa AbortSignal", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(weeklyTimeline);
    const signal = new AbortController().signal;

    await expect(
      timelineClient.weekly(
        "company/a",
        "2026-08-17",
        { assigneeId: "user/a", status: "PAUSED", priority: "HIGH" },
        { signal },
      ),
    ).resolves.toEqual(weeklyTimeline);
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/timeline/weekly?weekStart=2026-08-17&assigneeId=user%2Fa&status=PAUSED&priority=HIGH",
      { signal },
    );
  });

  it("não devolve payload inválido da API", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue({ ...weeklyTimeline, weekEnd: "invalid" });
    await expect(timelineClient.weekly("company-a", "2026-08-17")).rejects.toThrow(
      "Contrato da timeline semanal inválido",
    );
  });
});
