import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildApp } from "@/app";
import type { AppEnv } from "@/config/env";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/shared/errors/typed-errors";
import { createLogger } from "@/shared/logging/logger";

const prodConfig: AppEnv = {
  NODE_ENV: "production",
  PORT: 3333,
  HOST: "0.0.0.0",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/orbis",
  LOG_LEVEL: "silent",
  JWT_ACCESS_SECRET: "a".repeat(40),
  JWT_REFRESH_SECRET: "b".repeat(40),
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "30d",
  FRONTEND_ORIGIN: "https://app.orbis.example",
  ARTIFACT_STORAGE_PATH: "./storage/releases",
};

const typedErrorCases = [
  { ErrorClass: NotFoundError, path: "/e/not-found", status: 404, code: "NOT_FOUND" },
  { ErrorClass: UnauthorizedError, path: "/e/unauthorized", status: 401, code: "UNAUTHORIZED" },
  { ErrorClass: ForbiddenError, path: "/e/forbidden", status: 403, code: "FORBIDDEN" },
  { ErrorClass: ValidationError, path: "/e/validation", status: 400, code: "VALIDATION_ERROR" },
  { ErrorClass: ConflictError, path: "/e/conflict", status: 409, code: "CONFLICT" },
  { ErrorClass: BusinessRuleError, path: "/e/business", status: 422, code: "BUSINESS_RULE" },
] as const;

describe("tratamento global de erros", () => {
  it.each(typedErrorCases)(
    "$ErrorClass é traduzido para $status $code",
    async ({ ErrorClass, path, status, code }) => {
      const app = await buildApp({ logger: false });
      app.get(path, () => {
        throw new ErrorClass("mensagem de teste");
      });

      const response = await app.inject({ method: "GET", url: path });

      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({
        error: { code, message: "mensagem de teste" },
      });

      await app.close();
    },
  );

  it("inclui details no body quando o erro possui detalhes", async () => {
    const app = await buildApp({ logger: false });
    app.get("/e/with-details", () => {
      throw new ValidationError("Campo inválido", { details: { field: "email" } });
    });

    const response = await app.inject({ method: "GET", url: "/e/with-details" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Campo inválido",
        details: { field: "email" },
      },
    });

    await app.close();
  });

  it("converte ZodError em 400 VALIDATION_ERROR com issues", async () => {
    const app = await buildApp({ logger: false });
    app.get("/e/zod", () => {
      const result = z.string().safeParse(123);
      if (result.success) {
        throw new Error("não deveria passar");
      }
      throw result.error;
    });

    const response = await app.inject({ method: "GET", url: "/e/zod" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "Entrada inválida" },
    });
    expect(Array.isArray(response.json().error.details.issues)).toBe(true);

    await app.close();
  });

  it("traduz falha de validação do schema Fastify em 400", async () => {
    const app = await buildApp({ logger: false });
    app.get(
      "/e/schema",
      {
        schema: {
          querystring: {
            type: "object",
            properties: { q: { type: "integer" } },
            required: ["q"],
          },
        },
      },
      () => ({ ok: true }),
    );

    const response = await app.inject({ method: "GET", url: "/e/schema" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    await app.close();
  });

  it("mantém o 404 padrão para rota inexistente", async () => {
    const app = await buildApp({ logger: false });

    const response = await app.inject({ method: "GET", url: "/nao-existe" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Rota não encontrada: GET /nao-existe" },
    });

    await app.close();
  });

  it("não expõe detalhes internos de erro desconhecido em produção", async () => {
    const app = await buildApp({ logger: false, config: prodConfig });
    app.get("/e/bang", () => {
      throw new Error("detalhe interno sensível");
    });

    const response = await app.inject({ method: "GET", url: "/e/bang" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    });

    await app.close();
  });

  it("expõe a mensagem de erro desconhecido fora de produção", async () => {
    const app = await buildApp({ logger: false });
    app.get("/e/bang-dev", () => {
      throw new Error("mensagem visível em dev");
    });

    const response = await app.inject({ method: "GET", url: "/e/bang-dev" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "mensagem visível em dev" },
    });

    await app.close();
  });

  it("inclui request id nos logs de request", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = createLogger({ level: "info", destination: stream });

    const app = await buildApp({ logger });
    app.get("/log-test", async (request) => {
      request.log.info("requisição processada");
      return { ok: true };
    });

    const response = await app.inject({ method: "GET", url: "/log-test" });

    expect(response.statusCode).toBe(200);
    const parsed = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    const requestLog = parsed.find((line) => line.msg === "requisição processada");
    expect(requestLog).toBeDefined();
    expect(typeof requestLog?.reqId).toBe("string");

    await app.close();
  });
});
