import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import scalarApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";

import { registerHealthRoute } from "./modules/health/health.routes.js";

export interface BuildAppOptions {
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Orbis API",
        description:
          "API do Orbis — gestão de requisições, tarefas, capacidade, Kanban e timelines.",
        version: "0.1.0",
      },
      servers: [{ url: "http://localhost:3333" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(scalarApiReference, {
    routePrefix: "/reference",
  });

  registerHealthRoute(app);

  return app;
}
