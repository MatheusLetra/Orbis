import { describe, expect, it } from "vitest";
import type { UseCase } from "./use-case";

describe("UseCase", () => {
  it("define o contrato execute", async () => {
    const sum: UseCase<{ a: number; b: number }, number> = {
      execute: async ({ a, b }) => a + b,
    };

    expect(await sum.execute({ a: 2, b: 3 })).toBe(5);
  });
});
