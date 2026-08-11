import { describe, expect, it } from "vitest";
import { parseTtlToMs } from "./ttl";

describe("parseTtlToMs", () => {
  it("converte unidades de tempo para milissegundos", () => {
    expect(parseTtlToMs("500ms")).toBe(500);
    expect(parseTtlToMs("1s")).toBe(1000);
    expect(parseTtlToMs("5m")).toBe(300_000);
    expect(parseTtlToMs("2h")).toBe(7_200_000);
    expect(parseTtlToMs("1d")).toBe(86_400_000);
  });

  it("ignora espaços em branco", () => {
    expect(parseTtlToMs(" 15m ")).toBe(900_000);
  });

  it("lança erro para formato inválido", () => {
    expect(() => parseTtlToMs("15")).toThrow("TTL inválido");
    expect(() => parseTtlToMs("abc")).toThrow("TTL inválido");
    expect(() => parseTtlToMs("")).toThrow("TTL inválido");
  });
});
