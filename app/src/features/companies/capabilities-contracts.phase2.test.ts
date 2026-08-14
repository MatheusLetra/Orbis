import { describe, expect, it } from "vitest";
import { COMPANY_CAPABILITY_NAMES, parseCompanyCapabilities } from "./capabilities-contracts";

const capabilities = Object.fromEntries(COMPANY_CAPABILITY_NAMES.map((name) => [name, false]));

describe("capabilities parser uncovered inputs", () => {
  it.each([
    null,
    [],
    {},
    { companyId: 1, capabilities },
    { companyId: "company-a", capabilities: [] },
  ])("rejeita envelope inválido %#", (value) => {
    expect(() => parseCompanyCapabilities(value)).toThrow("Contrato de capabilities inválido");
  });

  it("rejeita valor não booleano em qualquer capability conhecida", () => {
    expect(() =>
      parseCompanyCapabilities({
        companyId: "company-a",
        capabilities: { ...capabilities, "tasks.update": 1 },
      }),
    ).toThrow("Contrato de capabilities inválido");
  });
});
