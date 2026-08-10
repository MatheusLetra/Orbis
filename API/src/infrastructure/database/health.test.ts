import { describe, expect, it } from "vitest";
import { checkDatabaseHealth } from "./health.js";

const okDatabase = {
  execute: async () => undefined,
} as never;

const failingDatabase = {
  execute: async () => {
    throw new Error("connection refused");
  },
} as never;

describe("checkDatabaseHealth", () => {
  it("retorna status ok quando a query simples funciona", async () => {
    const result = await checkDatabaseHealth(okDatabase);

    expect(result.status).toBe("ok");
    expect(result.latencyMs).toBeTypeOf("number");
  });

  it("retorna status unavailable quando o banco está indisponível", async () => {
    const result = await checkDatabaseHealth(failingDatabase);

    expect(result.status).toBe("unavailable");
    expect(result.latencyMs).toBeUndefined();
  });
});
