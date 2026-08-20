import type { FastifyInstance, FastifyRequest } from "fastify";

import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import type { AddRequisitionAssignee } from "@/modules/requisitions/application/use-cases/add-requisition-assignee";
import type { CreateRequisition } from "@/modules/requisitions/application/use-cases/create-requisition";
import type { DeleteRequisition } from "@/modules/requisitions/application/use-cases/delete-requisition";
import type { GetRequisition } from "@/modules/requisitions/application/use-cases/get-requisition";
import type { ListRequisitionAssignees } from "@/modules/requisitions/application/use-cases/list-requisition-assignees";
import type { ListRequisitions } from "@/modules/requisitions/application/use-cases/list-requisitions";
import type { RemoveRequisitionAssignee } from "@/modules/requisitions/application/use-cases/remove-requisition-assignee";
import type { UpdateRequisition } from "@/modules/requisitions/application/use-cases/update-requisition";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface RequisitionRouteOptions {
  create: CreateRequisition;
  update: UpdateRequisition;
  list: ListRequisitions;
  get: GetRequisition;
  delete: DeleteRequisition;
  addAssignee: AddRequisitionAssignee;
  removeAssignee: RemoveRequisitionAssignee;
  listAssignees: ListRequisitionAssignees;
  permissionResolver: PermissionResolver;
}

const userHeader = {
  type: "object",
  properties: {
    authorization: { type: "string", description: "Token de acesso: Bearer <token>" },
  },
} as const;

const requisitionParams = {
  type: "object",
  properties: { companyId: { type: "string", format: "uuid" } },
  required: ["companyId"],
} as const;

const requisitionDetailParams = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    requisitionId: { type: "string", format: "uuid" },
  },
  required: ["companyId", "requisitionId"],
} as const;

const assigneeParams = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    requisitionId: { type: "string", format: "uuid" },
    userId: { type: "string", format: "uuid" },
  },
  required: ["companyId", "requisitionId", "userId"],
} as const;

const requisitionResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    number: { type: "integer" },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "PAUSED", "DONE", "CANCELLED"] },
    requesterId: { type: "string" },
    responsibleId: { type: ["string", "null"] },
    systemId: { type: ["string", "null"] },
    systemVersionId: { type: ["string", "null"] },
    estimatedHours: { type: ["number", "null"] },
    startDate: { type: ["string", "null"], format: "date-time" },
    plannedDeliveryDate: { type: ["string", "null"], format: "date-time" },
    deliveredAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "companyId",
    "number",
    "title",
    "description",
    "priority",
    "status",
    "requesterId",
    "responsibleId",
    "systemId",
    "systemVersionId",
    "estimatedHours",
    "startDate",
    "plannedDeliveryDate",
    "deliveredAt",
    "createdAt",
    "updatedAt",
  ],
} as const;

const assigneeResponse = {
  type: "object",
  properties: {
    userId: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["userId", "createdAt"],
  additionalProperties: false,
} as const;

const requisitionDetailResponse = {
  ...requisitionResponse,
  properties: {
    ...requisitionResponse.properties,
    assignees: { type: "array", items: assigneeResponse },
  },
  required: [...requisitionResponse.required, "assignees"],
} as const;

const createBody = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    responsibleId: { type: "string", format: "uuid" },
    systemId: { type: "string", format: "uuid" },
    systemVersionId: { type: "string", format: "uuid" },
    estimatedHours: { type: "number" },
    startDate: { type: "string", anyOf: [{ format: "date" }, { format: "date-time" }] },
    plannedDeliveryDate: { type: "string", anyOf: [{ format: "date" }, { format: "date-time" }] },
  },
  required: ["title"],
  additionalProperties: true,
} as const;

const updateBody = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: ["string", "null"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    responsibleId: { type: ["string", "null"], format: "uuid" },
    systemId: { type: ["string", "null"], format: "uuid" },
    systemVersionId: { type: ["string", "null"], format: "uuid" },
    estimatedHours: { type: ["number", "null"] },
    startDate: {
      anyOf: [
        { type: "null" },
        { type: "string", format: "date" },
        { type: "string", format: "date-time" },
      ],
    },
    plannedDeliveryDate: {
      anyOf: [
        { type: "null" },
        { type: "string", format: "date" },
        { type: "string", format: "date-time" },
      ],
    },
    deliveredAt: { type: ["string", "null"], format: "date-time" },
  },
  additionalProperties: true,
} as const;

const listQuery = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "PAUSED", "DONE", "CANCELLED"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    responsibleId: { type: "string", format: "uuid" },
    search: { type: "string", maxLength: 200 },
  },
  additionalProperties: false,
} as const;

function dates<T extends Record<string, unknown>>(data: T, fields: readonly string[]): T {
  const output: Record<string, unknown> = { ...data };
  for (const field of fields) {
    const value = output[field];
    if (typeof value === "string") {
      output[field] = new Date(value);
    }
  }
  return output as T;
}

function assertAllowedKeys(data: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(data).some((key) => !allowed.includes(key))) {
    throw new ValidationError("Entrada inválida");
  }
}

function assertAllowedQuery(request: FastifyRequest, allowed: readonly string[]): void {
  const query = request.url.split("?", 2)[1];
  if (!query) return;
  const keys = query.split("&").map((part) => decodeURIComponent(part.split("=", 1)[0] ?? ""));
  if (keys.some((key) => !allowed.includes(key))) {
    throw new ValidationError("Entrada inválida");
  }
}

async function actorFor(
  request: FastifyRequest,
  companyId: string,
  permissionResolver: PermissionResolver,
) {
  return permissionResolver.resolve(getCurrentUserId(request), companyId);
}

export async function registerRequisitionRoutes(
  app: FastifyInstance,
  options: RequisitionRouteOptions,
): Promise<void> {
  app.post(
    "/companies/:companyId/requisitions",
    {
      schema: {
        tags: ["Requisições"],
        description: "Cria uma requisição.",
        headers: userHeader,
        params: requisitionParams,
        body: createBody,
        response: { 201: requisitionResponse },
      },
    },
    async (request, reply) => {
      const { companyId } = request.params as { companyId: string };
      const data = request.body as Record<string, unknown>;
      assertAllowedKeys(data, [
        "title",
        "description",
        "priority",
        "responsibleId",
        "systemId",
        "systemVersionId",
        "estimatedHours",
        "startDate",
        "plannedDeliveryDate",
      ]);
      const actor = await actorFor(request, companyId, options.permissionResolver);
      const output = await options.create.execute({
        actor,
        data: dates(data, ["startDate", "plannedDeliveryDate"]) as never,
      });
      return reply.status(201).send(output);
    },
  );

  app.get(
    "/companies/:companyId/requisitions",
    {
      schema: {
        tags: ["Requisições"],
        description: "Lista as requisições da empresa.",
        headers: userHeader,
        params: requisitionParams,
        querystring: listQuery,
        response: { 200: { type: "array", items: requisitionResponse } },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      assertAllowedQuery(request, ["status", "priority", "responsibleId", "search"]);
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.list.execute({ actor, filters: request.query as never });
    },
  );

  app.get(
    "/companies/:companyId/requisitions/:requisitionId",
    {
      schema: {
        tags: ["Requisições"],
        description: "Obtém uma requisição com sua equipe.",
        headers: userHeader,
        params: requisitionDetailParams,
        response: { 200: requisitionDetailResponse },
      },
    },
    async (request) => {
      const { companyId, requisitionId } = request.params as {
        companyId: string;
        requisitionId: string;
      };
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.get.execute({ actor, requisitionId });
    },
  );

  app.patch(
    "/companies/:companyId/requisitions/:requisitionId",
    {
      schema: {
        tags: ["Requisições"],
        description: "Atualiza parcialmente uma requisição.",
        headers: userHeader,
        params: requisitionDetailParams,
        body: updateBody,
        response: { 200: requisitionResponse },
      },
    },
    async (request) => {
      const { companyId, requisitionId } = request.params as {
        companyId: string;
        requisitionId: string;
      };
      const changes = request.body as Record<string, unknown>;
      assertAllowedKeys(changes, [
        "title",
        "description",
        "priority",
        "responsibleId",
        "systemId",
        "systemVersionId",
        "estimatedHours",
        "startDate",
        "plannedDeliveryDate",
        "deliveredAt",
      ]);
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.update.execute({
        actor,
        requisitionId,
        changes: dates(changes, ["startDate", "plannedDeliveryDate", "deliveredAt"]) as never,
      });
    },
  );

  app.delete(
    "/companies/:companyId/requisitions/:requisitionId",
    {
      schema: {
        tags: ["Requisições"],
        description: "Remove uma requisição.",
        headers: userHeader,
        params: requisitionDetailParams,
        response: {
          200: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
        },
      },
    },
    async (request) => {
      const { companyId, requisitionId } = request.params as {
        companyId: string;
        requisitionId: string;
      };
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.delete.execute({ actor, requisitionId });
    },
  );

  app.post(
    "/companies/:companyId/requisitions/:requisitionId/assignees",
    {
      schema: {
        tags: ["Requisições"],
        description: "Adiciona um membro à equipe da requisição.",
        headers: userHeader,
        params: requisitionDetailParams,
        body: {
          type: "object",
          properties: { userId: { type: "string", format: "uuid" } },
          required: ["userId"],
          additionalProperties: false,
        },
        response: { 200: assigneeResponse },
      },
    },
    async (request) => {
      const { companyId, requisitionId } = request.params as {
        companyId: string;
        requisitionId: string;
      };
      const actor = await actorFor(request, companyId, options.permissionResolver);
      const { userId } = request.body as { userId: string };
      return options.addAssignee.execute({ actor, requisitionId, userId });
    },
  );

  app.delete(
    "/companies/:companyId/requisitions/:requisitionId/assignees/:userId",
    {
      schema: {
        tags: ["Requisições"],
        description: "Remove um membro da equipe da requisição.",
        headers: userHeader,
        params: assigneeParams,
        response: {
          200: {
            type: "object",
            properties: { requisitionId: { type: "string" }, userId: { type: "string" } },
            required: ["requisitionId", "userId"],
          },
        },
      },
    },
    async (request) => {
      const { companyId, requisitionId, userId } = request.params as {
        companyId: string;
        requisitionId: string;
        userId: string;
      };
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.removeAssignee.execute({ actor, requisitionId, userId });
    },
  );

  app.get(
    "/companies/:companyId/requisitions/:requisitionId/assignees",
    {
      schema: {
        tags: ["Requisições"],
        description: "Lista a equipe da requisição.",
        headers: userHeader,
        params: requisitionDetailParams,
        response: { 200: { type: "array", items: assigneeResponse } },
      },
    },
    async (request) => {
      const { companyId, requisitionId } = request.params as {
        companyId: string;
        requisitionId: string;
      };
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.listAssignees.execute({ actor, requisitionId });
    },
  );
}
