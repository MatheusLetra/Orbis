import { describe, expect, it } from "vitest";
import { attachmentKeys } from "./attachment-keys";

describe("attachment query keys", () => {
  it("inclui tenant e task e isola tenants", () => {
    expect(attachmentKeys.task("company-a", "task-a")).toEqual([
      "attachments",
      "task",
      "company-a",
      "task-a",
    ]);
    expect(attachmentKeys.task("company-a", "task-a")).not.toEqual(
      attachmentKeys.task("company-b", "task-a"),
    );
  });
});
