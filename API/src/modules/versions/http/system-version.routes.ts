import type { FastifyInstance } from "fastify";

import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import type { CreateSystemVersion } from "@/modules/versions/application/use-cases/create-system-version";
import type { DeleteSystemVersion } from "@/modules/versions/application/use-cases/delete-system-version";
import type { GetSystemVersion } from "@/modules/versions/application/use-cases/get-system-version";
import type { ListSystemVersions } from "@/modules/versions/application/use-cases/list-system-versions";
import type { UpdateSystemVersion } from "@/modules/versions/application/use-cases/update-system-version";

export interface SystemVersionRouteOptions {
  createSystemVersion: CreateSystemVersion;
  listSystemVersions: ListSystemVersions;
  getSystemVersion: GetSystemVersion;
  updateSystemVersion: UpdateSystemVersion;
  deleteSystemVersion: DeleteSystemVersion;
  permissionResolver: PermissionResolver;
}

const userHeader = {
  type: "object",
  properties: {
    authorization: { type: "string", description: "Token de acesso: Bearer <token>" },
  },
} as const;

const systemVersionResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    systemId: { type: "string" },
    version: { type: "string" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "companyId", "systemId", "version", "isActive", "createdAt", "updatedAt"],
} as const;

const systemVersionListResponse = {
  type: "array",
  items: systemVersionResponse,
} as const;

export async function registerSystemVersionRoutes(
  app: FastifyInstance,
  options: SystemVersionRouteOptions,
): Promise<void> {
  app.post(
    "/companies/:companyId/systems/:systemId/versions",
    {
      schema: {
        tags: ["Versões"],
        description: "Cria uma versão para um sistema.",
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
            version: { type: "string" },
          },
          required: ["version"],
        },
        response: { 201: systemVersionResponse },
      },
    },
    async (request, reply) => {
      const { companyId, systemId } = request.params as { companyId: string; systemId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      const output = await options.createSystemVersion.execute({
        actor,
        systemId,
        data: request.body as never,
      });
      return reply.status(201).send(output);
    },
  );

  app.get(
    "/companies/:companyId/systems/:systemId/versions",
    {
      schema: {
        tags: ["Versões"],
        description: "Lista as versões de um sistema.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            systemId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "systemId"],
        },
        response: { 200: systemVersionListResponse },
      },
    },
    async (request) => {
      const { companyId, systemId } = request.params as { companyId: string; systemId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.listSystemVersions.execute({ actor, systemId });
    },
  );

  app.get(
    "/companies/:companyId/versions/:versionId",
    {
      schema: {
        tags: ["Versões"],
        description: "Obtém uma versão pelo id.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            versionId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "versionId"],
        },
        response: { 200: systemVersionResponse },
      },
    },
    async (request) => {
      const { companyId, versionId } = request.params as { companyId: string; versionId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.getSystemVersion.execute({ actor, versionId });
    },
  );

  app.patch(
    "/companies/:companyId/versions/:versionId",
    {
      schema: {
        tags: ["Versões"],
        description: "Atualiza parcialmente uma versão.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            versionId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "versionId"],
        },
        body: {
          type: "object",
          properties: {
            version: { type: "string" },
          },
          additionalProperties: false,
        },
        response: { 200: systemVersionResponse },
      },
    },
    async (request) => {
      const { companyId, versionId } = request.params as { companyId: string; versionId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.updateSystemVersion.execute({
        actor,
        versionId,
        changes: request.body as never,
      });
    },
  );

  app.delete(
    "/companies/:companyId/versions/:versionId",
    {
      schema: {
        tags: ["Versões"],
        description: "Remove uma versão.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            versionId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "versionId"],
        },
        response: { 200: { type: "object", properties: { id: { type: "string" } } } },
      },
    },
    async (request) => {
      const { companyId, versionId } = request.params as { companyId: string; versionId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.deleteSystemVersion.execute({ actor, versionId });
    },
  );
}
