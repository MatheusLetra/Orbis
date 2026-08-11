import { describe, expect, it } from "vitest";

import { requireRow } from "./require-row";

describe("requireRow", () => {
  it("retorna o valor quando a linha existe", () => {
    expect(requireRow({ id: 1 })).toEqual({ id: 1 });
  });

  it("lança erro quando a linha é undefined", () => {
    expect(() => requireRow(undefined)).toThrow("Registro não encontrado");
  });

  it("lança a mensagem customizada", () => {
    expect(() => requireRow(undefined, "Linha ausente")).toThrow("Linha ausente");
  });
});
