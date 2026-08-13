import { describe, expect, it } from "vitest";
import type { CompanyCapabilities } from "@/features/companies/capabilities-contracts";
import { canEditTask } from "./task-authorization";

const own = { status: "TODO" as const, assigneeId: "user-a" };
const other = { status: "TODO" as const, assigneeId: "user-b" };
const unassigned = { status: "TODO" as const, assigneeId: null };
const done = { status: "DONE" as const, assigneeId: "user-a" };

function capabilities(
  values: Partial<CompanyCapabilities["capabilities"]> = {},
): CompanyCapabilities {
  return {
    companyId: "company-a",
    capabilities: {
      "tasks.create": false,
      "tasks.update": false,
      "kanban.manage": false,
      "hours.register": false,
      "users.read": false,
      "requisitions.read": false,
      ...values,
    },
  };
}

describe("canEditTask", () => {
  it("nega sem tasks.update ou com kanban.manage sozinho", () => {
    expect(canEditTask(own, capabilities(), "user-a")).toBe(false);
    expect(canEditTask(own, capabilities({ "kanban.manage": true }), "user-a")).toBe(false);
  });

  it("permite Task própria com tasks.update", () => {
    expect(canEditTask(own, capabilities({ "tasks.update": true }), "user-a")).toBe(true);
    expect(canEditTask(other, capabilities({ "tasks.update": true }), "user-a")).toBe(false);
  });

  it("permite qualquer Task não DONE com alcance global", () => {
    const global = capabilities({ "tasks.update": true, "kanban.manage": true });
    expect(canEditTask(own, global, "user-a")).toBe(true);
    expect(canEditTask(other, global, "user-a")).toBe(true);
    expect(canEditTask(unassigned, global, "user-a")).toBe(true);
  });

  it("nega DONE e permite self-claim apenas para um ator conhecido", () => {
    const ownOnly = capabilities({ "tasks.update": true });
    expect(canEditTask(done, ownOnly, "user-a")).toBe(false);
    expect(canEditTask(unassigned, ownOnly, "user-a", "claim")).toBe(true);
    expect(canEditTask(unassigned, ownOnly, null, "claim")).toBe(false);
    expect(canEditTask(unassigned, ownOnly, "user-a")).toBe(false);
  });

  it("não concede acesso sem capabilities carregadas", () => {
    expect(canEditTask(own, undefined, "user-a")).toBe(false);
    expect(canEditTask(own, null, "user-a")).toBe(false);
  });
});
