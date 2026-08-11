import type { FastifyInstance } from "fastify";
import type { Database } from "@/infrastructure/database/client";
import { checkDatabaseHealth } from "@/infrastructure/database/health";

export interface HealthRouteOptions {
  database?: Database;
}

export async function registerHealthRoute(
  app: FastifyInstance,
  options: HealthRouteOptions = {},
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
        },
      },
    },
    async () => {
      const database = options.database ? await checkDatabaseHealth(options.database) : undefined;

      return {
        status: "ok",
        service: "orbis-api",
        timestamp: new Date().toISOString(),
        ...(database ? { database } : {}),
      };
    },
  );
}
