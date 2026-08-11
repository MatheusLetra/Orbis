import { describe, expect, it } from "vitest";
import { Position } from "./position";

describe("Position", () => {
  it("cria um cargo válido", () => {
    const position = new Position("DESENVOLVEDOR");

    expect(position.get()).toBe("DESENVOLVEDOR");
  });

  it("remove espaços das bordas", () => {
    expect(new Position("  Gestor  ").get()).toBe("Gestor");
  });

  it("aceita cargos fora da lista inicial (lista aberta)", () => {
    expect(new Position("LÍDER TÉCNICO").get()).toBe("LÍDER TÉCNICO");
  });

  it("rejeita cargo vazio", () => {
    expect(() => new Position("   ")).toThrow("Cargo não pode ser vazio");
  });

  it("rejeita cargo longo demais", () => {
    expect(() => new Position("X".repeat(51))).toThrow("não pode exceder");
  });

  it("compara igualdade pelo valor", () => {
    expect(new Position("Gestor").equals(new Position("Gestor"))).toBe(true);
    expect(new Position("Gestor").equals(new Position("Suporte"))).toBe(false);
  });
});
