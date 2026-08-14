import { describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { monthlyTimelineClient } from "./monthly-client";
import { monthlyTimeline } from "./monthly-test-fixtures";

describe("cliente da timeline mensal", () => {
  it("codifica tenant/período/filtros e repassa AbortSignal", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(monthlyTimeline);
    const signal = new AbortController().signal;
    await expect(
      monthlyTimelineClient.list("company/a", "2026-08", { status: "DONE" }, { signal }),
    ).resolves.toEqual(monthlyTimeline);
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/timeline/monthly?period=2026-08&status=DONE",
      { signal },
    );
  });

  it("valida a resposta antes de devolvê-la", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue({ ...monthlyTimeline, period: "invalid" });
    await expect(monthlyTimelineClient.list("company-a", "2026-08")).rejects.toThrow(
      "Contrato da timeline mensal inválido",
    );
  });
});
