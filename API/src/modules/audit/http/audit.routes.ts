import type { FastifyInstance, FastifyRequest } from "fastify";
import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { ListAuditLogs } from "@/modules/audit/application/use-cases/list-audit-logs";
import { AUDIT_ACTIONS } from "@/modules/audit/domain/audit-action";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface AuditRouteOptions {
  list: ListAuditLogs;
  permissionResolver: PermissionResolver;
}

const errorResponse = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: { type: "object", additionalProperties: true },
      },
      required: ["code", "message"],
      additionalProperties: false,
    },
  },
  required: ["error"],
  additionalProperties: false,
} as const;

const params = {
  type: "object",
  properties: { companyId: { type: "string", format: "uuid" } },
  required: ["companyId"],
  additionalProperties: false,
} as const;

const query = {
  type: "object",
  properties: {
    action: { type: "string", enum: [...AUDIT_ACTIONS] },
    entityType: { type: "string", minLength: 1, maxLength: 100 },
    actorUserId: { type: "string", format: "uuid" },
    from: { type: "string", format: "date-time" },
    to: { type: "string", format: "date-time" },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
    cursor: { type: "string", minLength: 1, maxLength: 500 },
  },
  additionalProperties: false,
} as const;

const item = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    companyId: { type: ["string", "null"], format: "uuid" },
    actorUserId: { type: ["string", "null"], format: "uuid" },
    action: { type: "string", enum: [...AUDIT_ACTIONS] },
    entityType: { type: ["string", "null"] },
    entityId: { type: ["string", "null"] },
    metadata: { type: ["object", "null"], additionalProperties: true },
    createdAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "companyId",
    "actorUserId",
    "action",
    "entityType",
    "entityId",
    "metadata",
    "createdAt",
  ],
  additionalProperties: false,
} as const;

const response = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    items: { type: "array", items: item },
    hasMore: { type: "boolean" },
    nextCursor: { type: ["string", "null"] },
  },
  required: ["companyId", "items", "hasMore", "nextCursor"],
  additionalProperties: false,
} as const;

function assertAllowedQuery(request: FastifyRequest): void {
  const raw = request.url.split("?", 2)[1];
  if (!raw) return;
  const keys = raw.split("&").map((part) => decodeURIComponent(part.split("=", 1)[0] ?? ""));
  const allowed = ["action", "entityType", "actorUserId", "from", "to", "limit", "cursor"];
  if (keys.some((key) => !allowed.includes(key))) throw new ValidationError("Entrada inválida");
}

export async function registerAuditRoutes(
  app: FastifyInstance,
  options: AuditRouteOptions,
): Promise<void> {
  app.get(
    "/companies/:companyId/audit",
    {
      schema: {
        tags: ["Auditoria"],
        description: "Lista os registros de auditoria da empresa autenticada.",
        params,
        querystring: query,
        response: {
          200: response,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request) => {
      assertAllowedQuery(request);
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.list.execute({ actor, companyId, query: request.query as never });
    },
  );
}
