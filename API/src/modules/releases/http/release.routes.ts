import type { FastifyInstance } from "fastify";

import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import type { CreateRelease } from "@/modules/releases/application/use-cases/create-release";
import type { DeleteRelease } from "@/modules/releases/application/use-cases/delete-release";
import type { GetRelease } from "@/modules/releases/application/use-cases/get-release";
import type { ListReleases } from "@/modules/releases/application/use-cases/list-releases";
import type { PublishRelease } from "@/modules/releases/application/use-cases/publish-release";
import type { UpdateReleaseMetadata } from "@/modules/releases/application/use-cases/update-release-metadata";

export interface ReleaseRouteOptions {
  createRelease: CreateRelease;
  listReleases: ListReleases;
  getRelease: GetRelease;
  publishRelease: PublishRelease;
  updateReleaseMetadata: UpdateReleaseMetadata;
  deleteRelease: DeleteRelease;
  permissionResolver: PermissionResolver;
}

const userHeader = {
  type: "object",
  properties: {
    authorization: { type: "string", description: "Token de acesso: Bearer <token>" },
  },
} as const;

const releaseResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    systemVersionId: { type: "string" },
    versionLabel: { type: "string" },
    channel: { type: "string" },
    status: { type: "string" },
    artifactName: { type: ["string", "null"] },
    artifactLocation: { type: ["string", "null"], maxLength: 2048 },
    publishedAt: { type: ["string", "null"], format: "date-time" },
    createdBy: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "companyId",
    "systemVersionId",
    "versionLabel",
    "channel",
    "status",
    "artifactName",
    "artifactLocation",
    "publishedAt",
    "createdBy",
    "createdAt",
  ],
} as const;

const releaseListResponse = {
  type: "array",
  items: releaseResponse,
} as const;

export async function registerReleaseRoutes(
  app: FastifyInstance,
  options: ReleaseRouteOptions,
): Promise<void> {
  app.post(
    "/companies/:companyId/releases",
    {
      schema: {
        tags: ["Releases"],
        description: "Cria uma release em rascunho vinculada a uma versão.",
        headers: userHeader,
        params: {
          type: "object",
          properties: { companyId: { type: "string", format: "uuid" } },
          required: ["companyId"],
        },
        body: {
          type: "object",
          properties: {
            systemVersionId: { type: "string", format: "uuid" },
            versionLabel: { type: "string" },
            channel: { type: "string", enum: ["STABLE", "BETA"] },
          },
          required: ["systemVersionId", "versionLabel"],
        },
        response: { 201: releaseResponse },
      },
    },
    async (request, reply) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      const output = await options.createRelease.execute({
        actor,
        data: request.body as never,
      });
      return reply.status(201).send(output);
    },
  );

  app.patch(
    "/companies/:companyId/releases/:releaseId",
    {
      schema: {
        tags: ["Releases"],
        description: "Atualiza os metadados de uma release em rascunho.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            releaseId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "releaseId"],
          additionalProperties: false,
        },
        body: {
          type: "object",
          properties: {
            versionLabel: { type: "string", minLength: 1, maxLength: 100 },
            channel: { type: "string", enum: ["STABLE", "BETA"] },
          },
          minProperties: 1,
          additionalProperties: false,
        },
        response: { 200: releaseResponse },
      },
    },
    async (request) => {
      const { companyId, releaseId } = request.params as { companyId: string; releaseId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.updateReleaseMetadata.execute({
        actor,
        releaseId,
        data: request.body as never,
      });
    },
  );

  app.get(
    "/companies/:companyId/releases",
    {
      schema: {
        tags: ["Releases"],
        description: "Lista as releases da empresa.",
        headers: userHeader,
        params: {
          type: "object",
          properties: { companyId: { type: "string", format: "uuid" } },
          required: ["companyId"],
        },
        response: { 200: releaseListResponse },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.listReleases.execute({ actor });
    },
  );

  app.get(
    "/companies/:companyId/releases/:releaseId",
    {
      schema: {
        tags: ["Releases"],
        description: "Obtém uma release pelo id.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            releaseId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "releaseId"],
        },
        response: { 200: releaseResponse },
      },
    },
    async (request) => {
      const { companyId, releaseId } = request.params as { companyId: string; releaseId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.getRelease.execute({ actor, releaseId });
    },
  );

  app.post(
    "/companies/:companyId/releases/:releaseId/publish",
    {
      schema: {
        tags: ["Releases"],
        description: "Publica uma release persistindo apenas os metadados e a localização manual.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            releaseId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "releaseId"],
        },
        body: {
          type: "object",
          properties: {
            artifactName: { type: "string", maxLength: 200 },
            artifactLocation: { type: "string", minLength: 1, maxLength: 2048 },
          },
          required: ["artifactName", "artifactLocation"],
        },
        response: {
          200: releaseResponse,
          409: {
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: { code: { type: "string" }, message: { type: "string" } },
                required: ["code", "message"],
              },
            },
            required: ["error"],
          },
        },
      },
    },
    async (request) => {
      const { companyId, releaseId } = request.params as { companyId: string; releaseId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.publishRelease.execute({
        actor,
        releaseId,
        data: request.body as never,
      });
    },
  );

  app.delete(
    "/companies/:companyId/releases/:releaseId",
    {
      schema: {
        tags: ["Releases"],
        description: "Remove uma release.",
        headers: userHeader,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            releaseId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "releaseId"],
        },
        response: { 200: { type: "object", properties: { id: { type: "string" } } } },
      },
    },
    async (request) => {
      const { companyId, releaseId } = request.params as { companyId: string; releaseId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.deleteRelease.execute({ actor, releaseId });
    },
  );
}
