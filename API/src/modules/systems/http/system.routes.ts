import type { FastifyInstance } from "fastify";

import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import type { CreateSystem } from "@/modules/systems/application/use-cases/create-system";
import type { DeleteSystem } from "@/modules/systems/application/use-cases/delete-system";
import type { GetSystem } from "@/modules/systems/application/use-cases/get-system";
import type { ListSystems } from "@/modules/systems/application/use-cases/list-systems";
import type { UpdateSystem } from "@/modules/systems/application/use-cases/update-system";

export interface SystemRouteOptions {
  createSystem: CreateSystem;
  listSystems: ListSystems;
  getSystem: GetSystem;
  updateSystem: UpdateSystem;
  deleteSystem: DeleteSystem;
  permissionResolver: PermissionResolver;
}

const userHeader = {
  type: "object",
  properties: {
    authorization: { type: "string", description: "Token de acesso: Bearer <token>" },
  },
} as const;

const systemResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    name: { type: "string" },
    description: { type: ["string", "null"] },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "companyId", "name", "description", "isActive", "createdAt", "updatedAt"],
} as const;

const systemListResponse = {
  type: "array",
  items: systemResponse,
} as const;

export async function registerSystemRoutes(
  app: FastifyInstance,
  options: SystemRouteOptions,
): Promise<void> {
  app.post(
    "/companies/:companyId/systems",
    {
      schema: {
        tags: ["Sistemas"],
        description: "Cria um sistema de software na empresa.",
        headers: userHeader,
        params: {
          type: "object",
          properties: { companyId: { type: "string", format: "uuid" } },
          required: ["companyId"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["name"],
        },
        response: { 201: systemResponse },
      },
    },
    async (request, reply) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      const output = await options.createSystem.execute({
        actor,
        data: request.body as never,
      });
      return reply.status(201).send(output);
    },
  );

  app.get(
    "/companies/:companyId/systems",
    {
      schema: {
        tags: ["Sistemas"],
        description: "Lista os sistemas da empresa.",
        headers: userHeader,
        params: {
          type: "object",
          properties: { companyId: { type: "string", format: "uuid" } },
          required: ["companyId"],
        },
        response: { 200: systemListResponse },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.listSystems.execute({ actor });
    },
  );

  app.get(
    "/companies/:companyId/systems/:systemId",
    {
      schema: {
        tags: ["Sistemas"],
        description: "Obtém um sistema pelo id.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            systemId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "systemId"],
        },
        response: { 200: systemResponse },
      },
    },
    async (request) => {
      const { companyId, systemId } = request.params as { companyId: string; systemId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.getSystem.execute({ actor, systemId });
    },
  );

  app.patch(
    "/companies/:companyId/systems/:systemId",
    {
      schema: {
        tags: ["Sistemas"],
        description: "Atualiza parcialmente um sistema.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            systemId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "systemId"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
        response: { 200: systemResponse },
      },
    },
    async (request) => {
      const { companyId, systemId } = request.params as { companyId: string; systemId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.updateSystem.execute({
        actor,
        systemId,
        changes: request.body as never,
      });
    },
  );

  app.delete(
    "/companies/:companyId/systems/:systemId",
    {
      schema: {
        tags: ["Sistemas"],
        description: "Remove um sistema.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            systemId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "systemId"],
        },
        response: { 200: { type: "object", properties: { id: { type: "string" } } } },
      },
    },
    async (request) => {
      const { companyId, systemId } = request.params as { companyId: string; systemId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.deleteSystem.execute({ actor, systemId });
    },
  );
}
