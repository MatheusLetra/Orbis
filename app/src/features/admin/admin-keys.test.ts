import { describe, expect, it } from "vitest";
import { adminKeys } from "./admin-keys";

describe("adminKeys", () => {
  it("isola listas e filtros por tenant", () => {
    expect(adminKeys.requisitions("company-a", "status=OPEN")).toEqual([
      "admin",
      "tenant",
      "company-a",
      "requisitions",
      "status=OPEN",
    ]);
    expect(adminKeys.audit("company-b", "limit=50")).not.toEqual(
      adminKeys.audit("company-a", "limit=50"),
    );
    expect([
      adminKeys.companies("company-a"),
      adminKeys.capacity("company-a"),
      adminKeys.members("company-a"),
      adminKeys.requisition("company-a", "req-a"),
      adminKeys.systems("company-a"),
      adminKeys.versions("company-a", "system-a"),
      adminKeys.releases("company-a"),
    ]).toHaveLength(7);
  });
});
