import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

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
});

describe("swagger", () => {
  it("gera documento openapi com as rotas registradas", async () => {
    const app = await buildApp({ logger: false });
    await app.ready();

    const appWithSwagger = app as unknown as {
      swagger: () => { paths: Record<string, unknown> };
    };
    const doc = appWithSwagger.swagger();

    expect(doc.paths).toHaveProperty("/health");

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
