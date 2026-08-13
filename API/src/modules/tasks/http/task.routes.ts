import type { FastifyInstance, FastifyRequest } from "fastify";

import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import type { CreateTask } from "@/modules/tasks/application/use-cases/create-task";
import type { GetTask } from "@/modules/tasks/application/use-cases/get-task";
import type { ListTasks } from "@/modules/tasks/application/use-cases/list-tasks";
import type { ListTimeEntries } from "@/modules/tasks/application/use-cases/list-time-entries";
import type { RegisterTimeEntry } from "@/modules/tasks/application/use-cases/register-time-entry";
import type { TransitionTaskStatus } from "@/modules/tasks/application/use-cases/transition-task-status";
import type { UpdateTask } from "@/modules/tasks/application/use-cases/update-task";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface TaskRouteOptions {
  create: CreateTask;
  update: UpdateTask;
  transition: TransitionTaskStatus;
  list: ListTasks;
  get: GetTask;
  registerTimeEntry: RegisterTimeEntry;
  listTimeEntries: ListTimeEntries;
  permissionResolver: PermissionResolver;
}

const userHeader = {
  type: "object",
  properties: {
    authorization: { type: "string", description: "Token de acesso: Bearer <token>" },
  },
} as const;

const taskParams = {
  type: "object",
  properties: { companyId: { type: "string", format: "uuid" } },
  required: ["companyId"],
  additionalProperties: false,
} as const;

const taskDetailParams = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    taskId: { type: "string", format: "uuid" },
  },
  required: ["companyId", "taskId"],
  additionalProperties: false,
} as const;

const taskResponse = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    companyId: { type: "string", format: "uuid" },
    requisitionId: { type: ["string", "null"], format: "uuid" },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    status: { type: "string", enum: ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] },
    assigneeId: { type: ["string", "null"], format: "uuid" },
    startDate: { type: ["string", "null"], format: "date-time" },
    plannedEndDate: { type: ["string", "null"], format: "date-time" },
    completedAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "companyId",
    "requisitionId",
    "title",
    "description",
    "priority",
    "status",
    "assigneeId",
    "startDate",
    "plannedEndDate",
    "completedAt",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
} as const;

const taskCardResponse = {
  ...taskResponse,
  properties: {
    ...taskResponse.properties,
    assignee: {
      type: ["object", "null"],
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
      },
      required: ["id", "name"],
      additionalProperties: false,
    },
    requisition: {
      type: ["object", "null"],
      properties: {
        id: { type: "string", format: "uuid" },
        number: { type: "integer" },
        title: { type: "string" },
      },
      required: ["id", "number", "title"],
      additionalProperties: false,
    },
  },
  required: [...taskResponse.required, "assignee", "requisition"],
} as const;

const historyResponse = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    taskId: { type: "string", format: "uuid" },
    fromStatus: { type: ["string", "null"], enum: ["TODO", "IN_PROGRESS", "PAUSED", "DONE", null] },
    toStatus: { type: "string", enum: ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] },
    changedBy: { type: "string", format: "uuid" },
    changedAt: { type: "string", format: "date-time" },
    metadata: { type: ["object", "null"], additionalProperties: true },
  },
  required: ["id", "taskId", "fromStatus", "toStatus", "changedBy", "changedAt", "metadata"],
  additionalProperties: false,
} as const;

const taskDetailResponse = {
  ...taskResponse,
  properties: { ...taskResponse.properties, history: { type: "array", items: historyResponse } },
  required: [...taskResponse.required, "history"],
} as const;

const createBody = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    assigneeId: { type: "string", format: "uuid" },
    requisitionId: { type: "string", format: "uuid" },
    startDate: { type: "string", format: "date-time" },
    plannedEndDate: { type: "string", format: "date-time" },
  },
  required: ["title"],
  additionalProperties: false,
} as const;

const updateBody = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: ["string", "null"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    assigneeId: { type: ["string", "null"], format: "uuid" },
    requisitionId: { type: ["string", "null"], format: "uuid" },
    startDate: { type: ["string", "null"], format: "date-time" },
    plannedEndDate: { type: ["string", "null"], format: "date-time" },
  },
  additionalProperties: false,
} as const;

const statusBody = {
  type: "object",
  properties: { status: { type: "string", enum: ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] } },
  required: ["status"],
  additionalProperties: false,
} as const;

const timeEntryBody = {
  type: "object",
  properties: {
    durationMinutes: { type: "integer", minimum: 1, maximum: 1440 },
    description: { type: "string", maxLength: 1000 },
  },
  required: ["durationMinutes"],
  additionalProperties: false,
} as const;

const timeEntryResponse = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    companyId: { type: "string", format: "uuid" },
    taskId: { type: "string", format: "uuid" },
    userId: { type: "string", format: "uuid" },
    startedAt: { type: ["string", "null"], format: "date-time" },
    endedAt: { type: ["string", "null"], format: "date-time" },
    durationMinutes: { type: "integer", minimum: 1, maximum: 1440 },
    description: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "companyId",
    "taskId",
    "userId",
    "startedAt",
    "endedAt",
    "durationMinutes",
    "description",
    "createdAt",
  ],
  additionalProperties: false,
} as const;

const timeEntryListQuery = {
  type: "object",
  properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 100 } },
  additionalProperties: false,
} as const;

const timeEntryListResponse = {
  type: "object",
  properties: {
    items: { type: "array", items: timeEntryResponse },
    totalDurationMinutes: { type: "integer", minimum: 0 },
    hasMore: { type: "boolean" },
  },
  required: ["items", "totalDurationMinutes", "hasMore"],
  additionalProperties: false,
} as const;

const listQuery = {
  type: "object",
  properties: {
    scope: { type: "string", enum: ["company", "own"], default: "company" },
    status: { type: "string", enum: ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    assigneeId: { type: "string", format: "uuid" },
    requisitionId: { type: "string", format: "uuid" },
    search: { type: "string", maxLength: 200 },
  },
  additionalProperties: false,
} as const;

function dates<T extends Record<string, unknown>>(data: T, fields: readonly string[]): T {
  const output: Record<string, unknown> = { ...data };
  for (const field of fields) {
    const value = output[field];
    if (typeof value === "string") output[field] = new Date(value);
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
  if (keys.some((key) => !allowed.includes(key))) throw new ValidationError("Entrada inválida");
}

async function actorFor(request: FastifyRequest, companyId: string, resolver: PermissionResolver) {
  return resolver.resolve(getCurrentUserId(request), companyId);
}

export async function registerTaskRoutes(
  app: FastifyInstance,
  options: TaskRouteOptions,
): Promise<void> {
  app.post(
    "/companies/:companyId/tasks",
    {
      schema: {
        tags: ["Tarefas"],
        description: "Cria uma tarefa.",
        headers: userHeader,
        params: taskParams,
        body: createBody,
        response: { 201: taskResponse },
      },
      preValidation: async (request) => {
        assertAllowedKeys(request.body as Record<string, unknown>, [
          "title",
          "description",
          "priority",
          "assigneeId",
          "requisitionId",
          "startDate",
          "plannedEndDate",
        ]);
      },
    },
    async (request, reply) => {
      const { companyId } = request.params as { companyId: string };
      const data = request.body as Record<string, unknown>;
      assertAllowedKeys(data, [
        "title",
        "description",
        "priority",
        "assigneeId",
        "requisitionId",
        "startDate",
        "plannedEndDate",
      ]);
      const actor = await actorFor(request, companyId, options.permissionResolver);
      const output = await options.create.execute({
        actor,
        data: dates(data, ["startDate", "plannedEndDate"]) as never,
      });
      return reply.status(201).send(output);
    },
  );

  app.get(
    "/companies/:companyId/tasks",
    {
      schema: {
        tags: ["Tarefas"],
        description: "Lista as tarefas da empresa.",
        headers: userHeader,
        params: taskParams,
        querystring: listQuery,
        response: { 200: { type: "array", items: taskCardResponse } },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      assertAllowedQuery(request, [
        "scope",
        "status",
        "priority",
        "assigneeId",
        "requisitionId",
        "search",
      ]);
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.list.execute({ actor, filters: request.query as never });
    },
  );

  app.get(
    "/companies/:companyId/tasks/:taskId",
    {
      schema: {
        tags: ["Tarefas"],
        description: "Obtém uma tarefa com o histórico de status.",
        headers: userHeader,
        params: taskDetailParams,
        response: { 200: taskDetailResponse },
      },
    },
    async (request) => {
      const { companyId, taskId } = request.params as { companyId: string; taskId: string };
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.get.execute({ actor, taskId });
    },
  );

  app.get(
    "/companies/:companyId/tasks/:taskId/time-entries",
    {
      schema: {
        tags: ["Apontamentos"],
        description: "Lista os apontamentos de horas de uma tarefa.",
        headers: userHeader,
        params: taskDetailParams,
        querystring: timeEntryListQuery,
        response: { 200: timeEntryListResponse },
      },
    },
    async (request) => {
      const { companyId, taskId } = request.params as { companyId: string; taskId: string };
      assertAllowedQuery(request, ["limit"]);
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.listTimeEntries.execute({
        actor,
        taskId,
        filters: request.query,
      });
    },
  );

  app.patch(
    "/companies/:companyId/tasks/:taskId",
    {
      schema: {
        tags: ["Tarefas"],
        description: "Atualiza parcialmente uma tarefa.",
        headers: userHeader,
        params: taskDetailParams,
        body: updateBody,
        response: { 200: taskResponse },
      },
      preValidation: async (request) => {
        assertAllowedKeys(request.body as Record<string, unknown>, [
          "title",
          "description",
          "priority",
          "assigneeId",
          "requisitionId",
          "startDate",
          "plannedEndDate",
        ]);
      },
    },
    async (request) => {
      const { companyId, taskId } = request.params as { companyId: string; taskId: string };
      const changes = request.body as Record<string, unknown>;
      assertAllowedKeys(changes, [
        "title",
        "description",
        "priority",
        "assigneeId",
        "requisitionId",
        "startDate",
        "plannedEndDate",
      ]);
      const actor = await actorFor(request, companyId, options.permissionResolver);
      return options.update.execute({
        actor,
        taskId,
        changes: dates(changes, ["startDate", "plannedEndDate"]) as never,
      });
    },
  );

  app.post(
    "/companies/:companyId/tasks/:taskId/time-entries",
    {
      schema: {
        tags: ["Apontamentos"],
        description: "Registra horas trabalhadas manualmente em uma tarefa.",
        headers: userHeader,
        params: taskDetailParams,
        body: timeEntryBody,
        response: { 201: timeEntryResponse },
      },
      preValidation: async (request) => {
        assertAllowedKeys(request.body as Record<string, unknown>, [
          "durationMinutes",
          "description",
        ]);
      },
    },
    async (request, reply) => {
      const { companyId, taskId } = request.params as { companyId: string; taskId: string };
      const body = request.body as Record<string, unknown>;
      assertAllowedKeys(body, ["durationMinutes", "description"]);
      const actor = await actorFor(request, companyId, options.permissionResolver);
      const output = await options.registerTimeEntry.execute({
        actor,
        taskId,
        data: body as never,
      });
      return reply.status(201).send(output);
    },
  );

  app.patch(
    "/companies/:companyId/tasks/:taskId/status",
    {
      schema: {
        tags: ["Tarefas"],
        description: "Transiciona o status de uma tarefa.",
        headers: userHeader,
        params: taskDetailParams,
        body: statusBody,
        response: { 200: taskResponse },
      },
      preValidation: async (request) => {
        assertAllowedKeys(request.body as Record<string, unknown>, ["status"]);
      },
    },
    async (request) => {
      const { companyId, taskId } = request.params as { companyId: string; taskId: string };
      const body = request.body as Record<string, unknown>;
      assertAllowedKeys(body, ["status"]);
      const actor = await actorFor(request, companyId, options.permissionResolver);
      const { status } = body as { status: "TODO" | "IN_PROGRESS" | "PAUSED" | "DONE" };
      return options.transition.execute({ actor, taskId, status });
    },
  );
}
