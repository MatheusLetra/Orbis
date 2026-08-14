import { describe, expect, it } from "vitest";
import { buildApp } from "@/app";

describe("GET /health", () => {
  it("responde com status ok e sem banco quando não conectado", async () => {
    const app = await buildApp({ logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "orbis-api",
    });
    expect(response.json()).not.toHaveProperty("database");

    await app.close();
  });

  it("inclui o status do banco quando database é fornecido", async () => {
    const database = {
      execute: async () => undefined,
    } as never;

    const app = await buildApp({ logger: false, database });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().database).toMatchObject({ status: "ok" });

    await app.close();
  });

  it("responde em estado de degradação quando o banco está indisponível", async () => {
    const database = {
      execute: async () => {
        throw new Error("connection refused");
      },
    } as never;

    const app = await buildApp({ logger: false, database });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().database).toMatchObject({ status: "unavailable" });

    await app.close();
  });
});
