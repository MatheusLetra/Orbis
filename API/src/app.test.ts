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
});

describe("swagger", () => {
  it("gera documento openapi com as rotas registradas", async () => {
    const app = await buildApp({ logger: false, modules: buildTestModules() });
    await app.ready();

    const appWithSwagger = app as unknown as {
      swagger: () => { paths: Record<string, unknown> };
    };
    const doc = appWithSwagger.swagger();

    expect(doc.paths).toHaveProperty("/health");
    expect(doc.paths).toHaveProperty("/users");
    expect(doc.paths).toHaveProperty("/companies");
    expect(doc.paths).toHaveProperty("/companies/{companyId}");
    expect(doc.paths).toHaveProperty("/memberships");

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
