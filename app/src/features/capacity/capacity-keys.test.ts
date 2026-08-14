import { describe, expect, it } from "vitest";
import { capacityKeys } from "./capacity-keys";

const input = { startDate: "2026-08-17T00:00:00.000Z", estimatedHours: 24 };

describe("capacityKeys", () => {
  it("isola tenant e cada simulação", () => {
    expect(capacityKeys.simulation("company-a", input)).not.toEqual(
      capacityKeys.simulation("company-b", input),
    );
    expect(capacityKeys.simulation("company-a", input)).not.toEqual(
      capacityKeys.simulation("company-a", { ...input, estimatedHours: 25 }),
    );
    expect(capacityKeys.simulation("company-a", input)).toEqual([
      "capacity",
      "simulation",
      "company-a",
      input.startDate,
      input.estimatedHours,
    ]);
  });
});
