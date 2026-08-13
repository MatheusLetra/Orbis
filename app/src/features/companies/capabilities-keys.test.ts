import { describe, expect, it } from "vitest";
import { capabilitiesKeys } from "./capabilities-keys";

describe("capabilitiesKeys", () => {
  it("isola cada empresa na query key", () => {
    expect(capabilitiesKeys.company("company-a")).not.toEqual(
      capabilitiesKeys.company("company-b"),
    );
    expect(capabilitiesKeys.company("company-a")).toEqual(["company-capabilities", "company-a"]);
  });
});
