import { describe, expect, it } from "vitest";
import { ValueObject } from "./value-object.js";

class Priority extends ValueObject<string> {}

class Point extends ValueObject<{ x: number; y: number }> {
  constructor(x: number, y: number) {
    super({ x, y });
  }
}

describe("ValueObject", () => {
  it("retorna o valor encapsulado", () => {
    expect(new Priority("HIGH").get()).toBe("HIGH");
  });

  it("é igual a outro value object com mesmo valor primitivo", () => {
    expect(new Priority("HIGH").equals(new Priority("HIGH"))).toBe(true);
  });

  it("não é igual a value object com valor diferente", () => {
    expect(new Priority("HIGH").equals(new Priority("LOW"))).toBe(false);
  });

  it("é igual a outro value object com mesmo valor de objeto", () => {
    expect(new Point(1, 2).equals(new Point(1, 2))).toBe(true);
  });

  it("não é igual a value object com objeto diferente", () => {
    expect(new Point(1, 2).equals(new Point(2, 1))).toBe(false);
  });

  it("não é igual a null ou undefined", () => {
    expect(new Priority("HIGH").equals(null as never)).toBe(false);
    expect(new Priority("HIGH").equals(undefined as never)).toBe(false);
  });

  it("converte para string", () => {
    expect(new Priority("MEDIUM").toString()).toBe("MEDIUM");
  });
});
