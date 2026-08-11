import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { buildTestModules } from "@/test/modules-test-helper";

async function build(): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false, modules: buildTestModules() });
  return app;
}

describe("POST /users", () => {
  it("cria um usuário e retorna 201", async () => {
    const app = await build();
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { email: "ana@orbis.io", name: "Ana", password: "senha-secreta" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({ email: "ana@orbis.io", name: "Ana", isActive: true });
    expect(body.id).toBeTypeOf("string");
    expect(body.passwordHash).toBeUndefined();
    await app.close();
  });

  it("retorna 409 quando o e-mail já existe", async () => {
    const app = await build();
    const payload = { email: "ana@orbis.io", name: "Ana", password: "senha-secreta" };
    await app.inject({ method: "POST", url: "/users", payload });
    const response = await app.inject({ method: "POST", url: "/users", payload });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("CONFLICT");
    await app.close();
  });

  it("retorna 400 para corpo inválido", async () => {
    const app = await build();
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: { email: "email-invalido", name: "", password: "curta" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});
