import { describe, expect, it } from "vitest";
import { parseCompanyCapabilities } from "./capabilities-contracts";

const validCapabilities = {
  "tasks.create": false,
  "tasks.update": false,
  "kanban.manage": false,
  "hours.register": true,
  "users.read": false,
  "requisitions.read": false,
};

describe("parseCompanyCapabilities", () => {
  it("aceita hours.register no contrato tenant-aware", () => {
    expect(
      parseCompanyCapabilities({ companyId: "company-a", capabilities: validCapabilities }),
    ).toEqual({ companyId: "company-a", capabilities: validCapabilities });
  });

  it.each([
    { ...validCapabilities, "hours.register": undefined },
    { ...validCapabilities, "unexpected.permission": true },
  ])("rejeita capability ausente ou inesperada", (capabilities) => {
    expect(() => parseCompanyCapabilities({ companyId: "company-a", capabilities })).toThrow(
      "Contrato de capabilities inválido",
    );
  });
});
