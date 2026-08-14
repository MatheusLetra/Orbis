import { describe, expect, it } from "vitest";
import { notificationKeys } from "./notification-keys";

describe("notificationKeys", () => {
  it("isola lista e preferências por tenant", () => {
    expect(notificationKeys.list("company-a")).toEqual([
      "notifications",
      "company-a",
      "list",
      { limit: 20 },
    ]);
    expect(notificationKeys.list("company-a")).not.toEqual(notificationKeys.list("company-b"));
    expect(notificationKeys.preferences("company-a")).toEqual([
      "notifications",
      "company-a",
      "preferences",
    ]);
  });
});
