import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { buildApp } from "@/app";
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

describe("POST /auth/login", () => {
  it("retorna access e refresh tokens com as credenciais corretas", async () => {
    const { app, modules } = await build();
    await seedUser(modules);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@orbis.io", password: "senha-secreta" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().accessToken).toBeTypeOf("string");
    expect(response.json().refreshToken).toBeTypeOf("string");
    expect(response.json().user).toMatchObject({ email: "ana@orbis.io", name: "Ana" });
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
  it("rotaciona o refresh token e retorna um novo par", async () => {
    const { app, modules } = await build();
    await seedUser(modules);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@orbis.io", password: "senha-secreta" },
    });
    const { refreshToken } = loginResponse.json();

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().accessToken).toBeTypeOf("string");
    expect(response.json().refreshToken).not.toBe(refreshToken);
    await app.close();
  });

  it("retorna 401 para refresh token inválido", async () => {
    const { app } = await build();

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: "token-invalido" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
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
    const { refreshToken } = loginResponse.json();

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(204);

    const reuseResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(reuseResponse.statusCode).toBe(401);
    await app.close();
  });

  it("é idempotente para refresh token inválido", async () => {
    const { app } = await build();

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken: "token-invalido" },
    });

    expect(response.statusCode).toBe(204);
    await app.close();
  });
});
