import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import scalarApiReference from "@scalar/fastify-api-reference";
import Fastify, { type FastifyInstance } from "fastify";
import type { Logger } from "pino";

import { type AppEnv, loadEnv } from "./config/env";
import type { OrbisModules } from "./infrastructure/composition-root";
import type { Database } from "./infrastructure/database/client";
import { createErrorHandler } from "./infrastructure/http/error-handler";
import { registerCompanyRoutes } from "./modules/companies/http/company.routes";
import { registerHealthRoute } from "./modules/health/health.routes";
import { registerMembershipRoutes } from "./modules/memberships/http/membership.routes";
import { registerUserRoutes } from "./modules/users/http/user.routes";
import { createLoggerConfig } from "./shared/logging/logger";

export interface BuildAppOptions {
  logger?: boolean | Logger;
  database?: Database;
  config?: AppEnv;
  modules?: OrbisModules;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? loadEnv();

  const fastifyOptions =
    typeof options.logger === "object" && options.logger !== null
      ? { loggerInstance: options.logger }
      : {
          logger:
            options.logger ??
            createLoggerConfig({ level: config.LOG_LEVEL, environment: config.NODE_ENV }),
        };

  const app = Fastify(fastifyOptions);

  app.setErrorHandler(
    createErrorHandler({ exposeInternalDetails: config.NODE_ENV !== "production" }),
  );

  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Rota não encontrada: ${request.method} ${request.url}`,
      },
    });
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

  registerHealthRoute(app as unknown as FastifyInstance, { database: options.database });

  if (options.modules) {
    const { modules } = options;
    const instance = app as unknown as FastifyInstance;
    await registerUserRoutes(instance, { createUser: modules.createUser });
    await registerCompanyRoutes(instance, modules);
    await registerMembershipRoutes(instance, modules);
  }

  return app;
}
