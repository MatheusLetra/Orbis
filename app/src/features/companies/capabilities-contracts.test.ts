import { describe, expect, it } from "vitest";
import { COMPANY_CAPABILITY_NAMES, parseCompanyCapabilities } from "./capabilities-contracts";

const validCapabilities = Object.fromEntries(
  COMPANY_CAPABILITY_NAMES.map((name) => [name, name === "hours.register"]),
);

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
