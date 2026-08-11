import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password-hasher";

describe("password-hasher (scrypt)", () => {
  it("gera um hash e verifica a senha correta", async () => {
    const hash = await hashPassword("senha-secreta");

    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await verifyPassword("senha-secreta", hash)).toBe(true);
  });

  it("gera hashes diferentes para o mesmo salt aleatório", async () => {
    const first = await hashPassword("mesma-senha");
    const second = await hashPassword("mesma-senha");

    expect(first).not.toBe(second);
  });

  it("rejeita senha incorreta", async () => {
    const hash = await hashPassword("senha-correta");

    expect(await verifyPassword("senha-errada", hash)).toBe(false);
  });

  it("rejeita hash com formato inválido", async () => {
    expect(await verifyPassword("qualquer", "hash-invalido")).toBe(false);
    expect(await verifyPassword("qualquer", "bcrypt:abc:def")).toBe(false);
  });
});
