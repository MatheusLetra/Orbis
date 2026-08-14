import type { FastifyInstance } from "fastify";
import type { Database } from "@/infrastructure/database/client";
import { checkDatabaseHealth } from "@/infrastructure/database/health";

export interface HealthRouteOptions {
  database?: Database;
  readiness: { ready: boolean };
}

export async function registerHealthRoute(
  app: FastifyInstance,
  options: HealthRouteOptions = { readiness: { ready: true } },
): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        description: "Health check da API, incluindo status do banco quando conectado.",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok"] },
              service: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
              database: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["ok", "unavailable"] },
                  latencyMs: { type: "number" },
                },
                required: ["status"],
              },
            },
            required: ["status", "service", "timestamp"],
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["unavailable"] },
              service: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
              database: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["ok", "unavailable"] },
                  latencyMs: { type: "number" },
                },
                required: ["status"],
              },
            },
            required: ["status", "service", "timestamp"],
          },
        },
      },
    },
    async (_request, reply) => {
      const database = options.database ? await checkDatabaseHealth(options.database) : undefined;
      const ready = options.readiness.ready && (!database || database.status === "ok");
      const output = {
        status: ready ? "ok" : "unavailable",
        service: "orbis-api",
        timestamp: new Date().toISOString(),
        ...(database ? { database } : {}),
      };
      return reply.status(ready ? 200 : 503).send(output);
    },
  );

  app.get(
    "/health/live",
    {
      schema: {
        tags: ["Health"],
        description: "Indica se o processo está vivo, sem consultar o banco.",
        response: { 200: { type: "object" } },
      },
    },
    async () => ({ status: "ok", service: "orbis-api", timestamp: new Date().toISOString() }),
  );

  app.get(
    "/health/ready",
    {
      schema: {
        tags: ["Health"],
        description: "Indica se a API está pronta para receber tráfego.",
        response: {
          200: { type: "object" },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              service: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
              database: { type: "object" },
            },
            required: ["status", "service", "timestamp"],
          },
        },
      },
    },
    async (_request, reply) => {
      const database = options.database ? await checkDatabaseHealth(options.database) : undefined;
      const ready = options.readiness.ready && (!database || database.status === "ok");
      return reply.status(ready ? 200 : 503).send({
        status: ready ? "ok" : "unavailable",
        service: "orbis-api",
        timestamp: new Date().toISOString(),
        ...(database ? { database } : {}),
      });
    },
  );
}
