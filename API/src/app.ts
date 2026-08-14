import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import scalarApiReference from "@scalar/fastify-api-reference";
import Fastify, { type FastifyInstance } from "fastify";
import type { Logger } from "pino";

import { type AppEnv, loadEnv } from "./config/env";
import type { OrbisModules } from "./infrastructure/composition-root";
import type { Database } from "./infrastructure/database/client";
import { createAuthenticateHook } from "./infrastructure/http/authenticate";
import { createErrorHandler } from "./infrastructure/http/error-handler";
import { registerAttachmentRoutes } from "./modules/attachments/http/attachment.routes";
import { registerAuthRoutes } from "./modules/auth/http/auth.routes";
import { registerCapacityRoutes } from "./modules/capacity/http/capacity.routes";
import { registerChatRoutes } from "./modules/chat/http/chat.routes";
import { registerCompanyRoutes } from "./modules/companies/http/company.routes";
import { registerHealthRoute } from "./modules/health/health.routes";
import { registerMembershipRoutes } from "./modules/memberships/http/membership.routes";
import { registerNotificationRoutes } from "./modules/notifications/http/notification.routes";
import { registerReleaseRoutes } from "./modules/releases/http/release.routes";
import { registerRequisitionRoutes } from "./modules/requisitions/http/requisition.routes";
import { registerSystemRoutes } from "./modules/systems/http/system.routes";
import { registerTaskRoutes } from "./modules/tasks/http/task.routes";
import { registerTimelineRoutes } from "./modules/timeline/http/timeline.routes";
import { registerUserRoutes } from "./modules/users/http/user.routes";
import { registerSystemVersionRoutes } from "./modules/versions/http/system-version.routes";
import { createLoggerConfig } from "./shared/logging/logger";
import { parseTtlToMs } from "./shared/utils/ttl";

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
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["X-Orbis-File-Name"],
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 2, fields: 2, parts: 4 },
  });

  await app.register(swagger, {
    transformObject: (documentObject) => {
      if (!("openapiObject" in documentObject)) return documentObject.swaggerObject;
      const document = documentObject.openapiObject;
      for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
        const operation = (pathItem as { post?: Record<string, unknown> }).post;
        if (!operation) continue;
        if (path === "/auth/login" || path === "/auth/refresh") {
          const responses = operation.responses as
            | Record<string, { headers?: Record<string, unknown> }>
            | undefined;
          const successResponse = responses?.["200"];
          if (successResponse) {
            successResponse.headers = {
              "Set-Cookie": {
                description: "Refresh token em cookie HttpOnly com escopo /auth.",
                schema: { type: "string" },
              },
            };
          }
        }
        if (!path.endsWith("/attachments/files")) continue;
        operation.requestBody = {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  title: { type: "string" },
                },
                required: ["file"],
                additionalProperties: false,
              },
            },
          },
        };
      }
      return document;
    },
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
          refreshCookie: {
            type: "apiKey",
            in: "cookie",
            name: "orbis_refresh_token",
            description: "Refresh token HttpOnly estabelecido pelo login.",
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
    await registerAuthRoutes(instance, {
      ...modules.auth,
      refreshCookie: {
        maxAgeSeconds: Math.floor(parseTtlToMs(config.JWT_REFRESH_TTL) / 1000),
        secure: config.NODE_ENV === "production",
      },
      frontendOrigin: config.FRONTEND_ORIGIN,
    });

    await instance.register(async (protectedRoutes) => {
      protectedRoutes.addHook("preHandler", createAuthenticateHook(modules.tokenService));
      await registerCompanyRoutes(protectedRoutes, modules);
      await registerMembershipRoutes(protectedRoutes, modules);
      if (modules.notifications) {
        await registerNotificationRoutes(protectedRoutes, {
          ...modules.notifications,
          permissionResolver: modules.permissionResolver,
        });
      }
      await registerCapacityRoutes(protectedRoutes, {
        calculateCapacity: modules.calculateCapacity,
        permissionResolver: modules.permissionResolver,
      });
      if (modules.chat) {
        await registerChatRoutes(protectedRoutes, {
          ...modules.chat,
          permissionResolver: modules.permissionResolver,
        });
      }
      if (modules.requisitions) {
        await registerRequisitionRoutes(protectedRoutes, {
          ...modules.requisitions,
          permissionResolver: modules.permissionResolver,
        });
      }
      await registerSystemRoutes(protectedRoutes, {
        ...modules.systems,
        permissionResolver: modules.permissionResolver,
      });
      await registerSystemVersionRoutes(protectedRoutes, {
        ...modules.versions,
        permissionResolver: modules.permissionResolver,
      });
      await registerReleaseRoutes(protectedRoutes, {
        ...modules.releases,
        permissionResolver: modules.permissionResolver,
      });
      await registerTaskRoutes(protectedRoutes, {
        ...modules.tasks,
        permissionResolver: modules.permissionResolver,
      });
      await registerTimelineRoutes(protectedRoutes, {
        ...modules.timeline,
        permissionResolver: modules.permissionResolver,
      });
      await registerAttachmentRoutes(protectedRoutes, {
        ...modules.attachments,
        permissionResolver: modules.permissionResolver,
      });
    });
  }

  return app;
}
