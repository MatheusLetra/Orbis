import { describe, expect, it } from "vitest";

import { scryptPasswordHasher } from "./scrypt-password-hasher";

describe("scryptPasswordHasher", () => {
  it("gera hash scrypt e verifica somente a senha correta", async () => {
    const hash = await scryptPasswordHasher.hash("senha-secreta");

    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    await expect(scryptPasswordHasher.verify("senha-secreta", hash)).resolves.toBe(true);
    await expect(scryptPasswordHasher.verify("senha-incorreta", hash)).resolves.toBe(false);
  });
});
