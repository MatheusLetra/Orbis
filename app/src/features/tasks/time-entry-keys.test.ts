import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ENTRY_LIMIT, timeEntryKeys } from "./time-entry-keys";

describe("time entry query keys", () => {
  it("inclui tenant, task e limit", () => {
    expect(timeEntryKeys.task("company-a", "task-a", 25)).toEqual([
      "time-entries",
      "task",
      "company-a",
      "task-a",
      25,
    ]);
    expect(timeEntryKeys.task("company-a", "task-a", 25)).not.toEqual(
      timeEntryKeys.task("company-b", "task-a", 25),
    );
    expect(timeEntryKeys.task("company-a", "task-a")).toContain(DEFAULT_TIME_ENTRY_LIMIT);
  });

  it("possui prefixo isolado por tenant e task", () => {
    expect(timeEntryKeys.taskPrefix("company-a", "task-a")).toEqual([
      "time-entries",
      "task",
      "company-a",
      "task-a",
    ]);
    expect(timeEntryKeys.taskPrefix("company-a", "task-a")).not.toEqual(
      timeEntryKeys.taskPrefix("company-b", "task-a"),
    );
    expect(timeEntryKeys.task("company-a", "task-b", 25)).not.toEqual(
      timeEntryKeys.task("company-a", "task-a", 25),
    );
  });
});
