import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { buildTestModules } from "./test/modules-test-helper";

describe("buildApp", () => {
  it("constrói a aplicação com opções padrão", async () => {
    const app = await buildApp();
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("registra as rotas de negócio quando módulos são fornecidos", async () => {
    const app = await buildApp({ logger: false, modules: buildTestModules() });

    const response = await app.inject({
      method: "GET",
      url: "/companies",
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("permite credentials apenas para a origem frontend configurada", async () => {
    const app = await buildApp({ logger: false });
    const allowed = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "GET",
      },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "GET",
      },
    });
    expect(denied.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(denied.headers["access-control-allow-origin"]).not.toBe("https://evil.example");
    await app.close();
  });
});

describe("swagger", () => {
  it("gera documento openapi com as rotas registradas", async () => {
    const app = await buildApp({ logger: false, modules: buildTestModules() });
    await app.ready();

    const appWithSwagger = app as unknown as {
      swagger: () => {
        paths: Record<string, Record<string, unknown>>;
        components?: { securitySchemes?: Record<string, unknown> };
      };
    };
    const doc = appWithSwagger.swagger();

    expect(doc.paths).toHaveProperty("/health");
    expect(doc.paths).toHaveProperty("/users");
    expect(doc.paths).toHaveProperty("/auth/login");
    expect(doc.paths).toHaveProperty("/auth/refresh");
    expect(doc.paths).toHaveProperty("/auth/logout");
    expect(doc.paths).toHaveProperty("/companies");
    expect(doc.paths).toHaveProperty("/companies/{companyId}");
    expect(doc.paths).toHaveProperty("/companies/{companyId}/capabilities");
    expect(doc.paths).toHaveProperty("/memberships");
    expect(doc.paths["/auth/login"]?.post).not.toHaveProperty(
      "responses.200.content.application/json.schema.properties.refreshToken",
    );
    expect(doc.paths["/auth/login"]?.post).toHaveProperty("responses.200.headers.Set-Cookie");
    expect(doc.components?.securitySchemes).toHaveProperty("refreshCookie");

    await app.close();
  });
});

describe("buildApp com database", () => {
  it("repassa o database para a rota de health", async () => {
    const database = {
      execute: async () => undefined,
    } as never;

    const app = await buildApp({ logger: false, database });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.json().database).toMatchObject({ status: "ok" });

    await app.close();
  });
});
