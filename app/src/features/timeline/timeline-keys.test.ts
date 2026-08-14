import { describe, expect, it } from "vitest";
import { timelineKeys } from "./timeline-keys";

describe("timelineKeys", () => {
  it("isola tenant, semana e filtros normalizados", () => {
    const key = timelineKeys.weekly("company-a", "2026-08-17", {
      status: "PAUSED",
      assigneeId: "",
    });
    expect(key).toEqual([
      "timeline",
      "weekly",
      "company-a",
      "2026-08-17",
      { assigneeId: undefined, status: "PAUSED", priority: undefined },
    ]);
    expect(key).not.toEqual(timelineKeys.weekly("company-b", "2026-08-17", { status: "PAUSED" }));
    expect(key).not.toEqual(timelineKeys.weekly("company-a", "2026-08-24", { status: "PAUSED" }));
  });
});
