import type { FastifyInstance } from "fastify";

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        description: "Health check da API.",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok"] },
              service: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
            required: ["status", "service", "timestamp"],
          },
        },
      },
    },
    async () => {
      return {
        status: "ok",
        service: "orbis-api",
        timestamp: new Date().toISOString(),
      };
    },
  );
}
