import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { buildApp } from "@/app";
import { loadEnv } from "@/config/env";
import { REFRESH_COOKIE_NAME } from "@/modules/auth/http/auth.routes";
import { User } from "@/modules/users/domain/entities/user";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

async function build(): Promise<{ app: FastifyInstance; modules: TestModules }> {
  const modules = buildTestModules();
  const app = await buildApp({ logger: false, modules });
  return { app, modules };
}

async function seedUser(modules: TestModules) {
  return modules.repositories.users.create(
    User.create({ email: "ana@orbis.io", name: "Ana", passwordHash: "scrypt:senha-secreta" }),
  );
}

function cookieFrom(response: { headers: Record<string, string | string[] | undefined> }): string {
  const setCookie = response.headers["set-cookie"];
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!value) throw new Error("Set-Cookie ausente");
  return value.split(";", 1)[0] ?? "";
}

describe("POST /auth/login", () => {
  it("retorna access token e estabelece refresh cookie HttpOnly", async () => {
    const { app, modules } = await build();
    await seedUser(modules);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@orbis.io", password: "senha-secreta" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().accessToken).toBeTypeOf("string");
    expect(response.json()).not.toHaveProperty("refreshToken");
    expect(response.json().user).toMatchObject({ email: "ana@orbis.io", name: "Ana" });
    expect(response.headers["set-cookie"]).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
    expect(response.headers["set-cookie"]).toContain("Path=/auth");
    expect(response.headers["set-cookie"]).toContain("Max-Age=2592000");
    expect(response.headers["set-cookie"]).not.toContain("Secure");
    await app.close();
  });

  it("retorna 401 para credenciais inválidas", async () => {
    const { app, modules } = await build();
    await seedUser(modules);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@orbis.io", password: "senha-errada" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
    await app.close();
  });

  it("marca o refresh cookie como Secure em produção", async () => {
    const modules = buildTestModules();
    const app = await buildApp({
      logger: false,
      modules,
      config: loadEnv({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a".repeat(40),
        JWT_REFRESH_SECRET: "b".repeat(40),
      }),
    });
    await seedUser(modules);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@orbis.io", password: "senha-secreta" },
    });

    expect(response.headers["set-cookie"]).toContain("Secure");
    await app.close();
  });

  it("retorna 400 para corpo inválido", async () => {
    const { app } = await build();

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "invalido", password: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});

describe("POST /auth/refresh", () => {
  it("rotaciona o refresh cookie e retorna somente novo access token", async () => {
    const { app, modules } = await build();
    await seedUser(modules);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@orbis.io", password: "senha-secreta" },
    });
    const loginCookie = cookieFrom(loginResponse);

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: loginCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().accessToken).toBeTypeOf("string");
    expect(response.json()).not.toHaveProperty("refreshToken");
    expect(cookieFrom(response)).not.toBe(loginCookie);
    await app.close();
  });

  it("retorna 401 para refresh cookie ausente ou inválido", async () => {
    const { app } = await build();

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");

    const invalidResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: `${REFRESH_COOKIE_NAME}=token-invalido` },
    });
    expect(invalidResponse.statusCode).toBe(401);
    await app.close();
  });

  it("rejeita refresh e logout de origem browser não autorizada", async () => {
    const { app } = await build();
    const headers = { origin: "https://evil.example" };

    const refresh = await app.inject({ method: "POST", url: "/auth/refresh", headers });
    const logout = await app.inject({ method: "POST", url: "/auth/logout", headers });

    expect(refresh.statusCode).toBe(403);
    expect(logout.statusCode).toBe(403);
    await app.close();
  });
});

describe("POST /auth/logout", () => {
  it("revoga o refresh token e retorna 204", async () => {
    const { app, modules } = await build();
    await seedUser(modules);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@orbis.io", password: "senha-secreta" },
    });
    const refreshCookie = cookieFrom(loginResponse);

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: refreshCookie },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
    expect(response.headers["set-cookie"]).toContain("Path=/auth");

    const reuseResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: refreshCookie },
    });
    expect(reuseResponse.statusCode).toBe(401);
    await app.close();
  });

  it("é idempotente sem cookie e sempre remove o cookie", async () => {
    const { app } = await build();

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
    await app.close();
  });
});
