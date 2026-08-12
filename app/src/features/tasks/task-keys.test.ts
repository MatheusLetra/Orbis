import { describe, expect, it } from "vitest";
import { normalizeTaskFilters, taskKeys } from "./task-keys";

describe("task query keys", () => {
  it("separa explicitamente empresas diferentes", () => {
    expect(taskKeys.list("company-a")).not.toEqual(taskKeys.list("company-b"));
  });

  it("inclui scope e todos os filtros normalizados", () => {
    expect(
      taskKeys.list("company-a", {
        scope: "own",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: "user-a",
        requisitionId: "req-a",
        search: "  tarefa  ",
      }),
    ).toEqual([
      "tasks",
      "list",
      "company-a",
      {
        scope: "own",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: "user-a",
        requisitionId: "req-a",
        search: "tarefa",
      },
    ]);
  });

  it("considera iguais filtros semanticamente equivalentes", () => {
    expect(taskKeys.list("company-a", { search: "  " })).toEqual(taskKeys.list("company-a"));
    expect(normalizeTaskFilters({ scope: "company" })).toEqual(normalizeTaskFilters());
  });
});
