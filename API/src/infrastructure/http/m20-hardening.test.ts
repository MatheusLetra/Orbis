import { describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { loadEnv } from "@/config/env";
import { createRateLimitHook } from "./rate-limit";

describe("M20 hardening", () => {
  it("aplica limite de tentativas por origem", async () => {
    const hook = createRateLimitHook(1, 60_000);
    const request = { ip: "127.0.0.1" } as never;
    await hook(request);
    await expect(hook(request)).rejects.toMatchObject({ statusCode: 429 });
  });

  it("expõe liveness, readiness e request id sem banco", async () => {
    const app = await buildApp({ logger: false });
    const live = await app.inject({ method: "GET", url: "/health/live" });
    expect(live.statusCode).toBe(200);
    expect(live.headers["x-request-id"]).toBeTruthy();

    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(200);

    app.orbisReadiness.ready = false;
    const unavailable = await app.inject({ method: "GET", url: "/health/ready" });
    expect(unavailable.statusCode).toBe(503);
    await app.close();
  });

  it("rejeita produção sem HTTPS ou banco explícito", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "aB1!xY2#".repeat(5),
        JWT_REFRESH_SECRET: "bC2@zW3$".repeat(5),
      }),
    ).toThrow(/DATABASE_URL/);
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:pass@host:5432/orbis",
        FRONTEND_ORIGIN: "http://localhost:5173",
        JWT_ACCESS_SECRET: "aB1!xY2#".repeat(5),
        JWT_REFRESH_SECRET: "bC2@zW3$".repeat(5),
      }),
    ).toThrow(/HTTPS/);
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:pass@host:5432/orbis",
        FRONTEND_ORIGIN: "https://app.orbis.test",
        JWT_ACCESS_SECRET: "a".repeat(40),
        JWT_REFRESH_SECRET: "bC2@zW3$".repeat(5),
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:pass@host:5432/orbis",
        FRONTEND_ORIGIN: "https://app.orbis.test",
        JWT_ACCESS_SECRET: "aB1!xY2#".repeat(5),
        JWT_REFRESH_SECRET: "b".repeat(40),
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("emite HSTS quando a configuração é produção", async () => {
    const app = await buildApp({
      logger: false,
      config: loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:pass@host:5432/orbis",
        FRONTEND_ORIGIN: "https://app.orbis.test",
        JWT_ACCESS_SECRET: "aB1!xY2#".repeat(5),
        JWT_REFRESH_SECRET: "bC2@zW3$".repeat(5),
      }),
    });
    const response = await app.inject({ method: "GET", url: "/health/live" });
    expect(response.headers["strict-transport-security"]).toContain("max-age");
    await app.close();
  });
});
