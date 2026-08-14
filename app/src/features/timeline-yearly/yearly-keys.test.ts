import { describe, expect, it } from "vitest";
import { yearlyTimelineKeys } from "./yearly-keys";

describe("yearlyTimelineKeys", () => {
  it("isola empresa, ano e filtros", () => {
    expect(yearlyTimelineKeys.list("a", "2026")).not.toEqual(yearlyTimelineKeys.list("b", "2026"));
    expect(yearlyTimelineKeys.list("a", "2026")).not.toEqual(yearlyTimelineKeys.list("a", "2027"));
  });
});
