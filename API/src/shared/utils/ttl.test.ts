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

  it("aceita os limites numéricos representáveis", () => {
    expect(parseTtlToMs("0ms")).toBe(0);
    expect(parseTtlToMs(`${Number.MAX_SAFE_INTEGER}ms`)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each(["15", "abc", "", "-1s", "+1s", "1.5s", "1S", "1 s"])(
    "lança erro para formato inválido: %s",
    (ttl) => {
      expect(() => parseTtlToMs(ttl)).toThrow(`TTL inválido: "${ttl}"`);
    },
  );
});
