import type { FastifyInstance, FastifyRequest } from "fastify";

import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import type { GetMonthlyRequisitionTimeline } from "@/modules/timeline/application/use-cases/get-monthly-requisition-timeline";
import type { GetWeeklyTimeline } from "@/modules/timeline/application/use-cases/get-weekly-timeline";
import type { GetYearlyRequisitionTimeline } from "@/modules/timeline/application/use-cases/get-yearly-requisition-timeline";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface TimelineRouteOptions {
  getWeekly: GetWeeklyTimeline;
  getMonthly: GetMonthlyRequisitionTimeline;
  getYearly: GetYearlyRequisitionTimeline;
  permissionResolver: PermissionResolver;
}

const userHeader = {
  type: "object",
  properties: {
    authorization: { type: "string", description: "Token de acesso: Bearer <token>" },
  },
} as const;

const companyParams = {
  type: "object",
  properties: { companyId: { type: "string", format: "uuid" } },
  required: ["companyId"],
  additionalProperties: false,
} as const;

const weeklyQuery = {
  type: "object",
  properties: {
    weekStart: { type: "string", format: "date", description: "Segunda-feira da semana." },
    assigneeId: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
  },
  required: ["weekStart"],
  additionalProperties: false,
} as const;

const monthlyQuery = {
  type: "object",
  properties: {
    period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    assigneeId: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "PAUSED", "DONE", "CANCELLED"] },
  },
  required: ["period"],
  additionalProperties: false,
} as const;

const monthlyItem = {
  type: "object",
  properties: {
    requisitionId: { type: "string", format: "uuid" },
    number: { type: "integer" },
    title: { type: "string" },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    assigneeId: { type: ["string", "null"], format: "uuid" },
    assigneeName: { type: ["string", "null"] },
    startDate: { type: ["string", "null"], format: "date" },
    plannedDeliveryDate: { type: ["string", "null"], format: "date" },
    deliveredAt: { type: ["string", "null"], format: "date-time" },
    estimatedHours: { type: "number" },
    isOverdue: { type: "boolean" },
    deliveredOnTime: { type: "boolean" },
  },
  required: [
    "requisitionId",
    "number",
    "title",
    "priority",
    "assigneeId",
    "startDate",
    "plannedDeliveryDate",
    "deliveredAt",
    "estimatedHours",
    "isOverdue",
    "deliveredOnTime",
  ],
  additionalProperties: false,
} as const;

const monthlyResponse = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
    items: { type: "array", items: monthlyItem },
    undatedItems: { type: "array", items: monthlyItem },
    indicators: {
      type: "object",
      properties: {
        totalRequisitions: { type: "integer" },
        estimatedHours: { type: "number" },
        deliveredOnTime: { type: "integer" },
        overdue: { type: "integer" },
      },
      required: ["totalRequisitions", "estimatedHours", "deliveredOnTime", "overdue"],
      additionalProperties: false,
    },
  },
  required: ["companyId", "period", "items", "undatedItems", "indicators"],
  additionalProperties: false,
} as const;

const yearlyQuery = {
  type: "object",
  properties: {
    year: { type: "string", pattern: "^\\d{4}$" },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    assigneeId: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "PAUSED", "DONE", "CANCELLED"] },
  },
  required: ["year"],
  additionalProperties: false,
} as const;

const yearlyMonth = {
  type: "object",
  properties: {
    period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
    requisitionCount: { type: "integer" },
    countsByPriority: {
      type: "object",
      properties: {
        LOW: { type: "integer" },
        MEDIUM: { type: "integer" },
        HIGH: { type: "integer" },
      },
      required: ["LOW", "MEDIUM", "HIGH"],
      additionalProperties: false,
    },
    estimatedHours: { type: "number" },
    deliveredOnTime: { type: "integer" },
    overdue: { type: "integer" },
    items: { type: "array", items: monthlyItem },
    undatedItems: { type: "array", items: monthlyItem },
  },
  required: [
    "period",
    "requisitionCount",
    "countsByPriority",
    "estimatedHours",
    "deliveredOnTime",
    "overdue",
    "items",
    "undatedItems",
  ],
  additionalProperties: false,
} as const;

const yearlyResponse = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    year: { type: "string", pattern: "^\\d{4}$" },
    months: { type: "array", minItems: 12, maxItems: 12, items: yearlyMonth },
    indicators: {
      type: "object",
      properties: {
        totalRequisitions: { type: "integer" },
        estimatedHours: { type: "number" },
        deliveredOnTime: { type: "integer" },
        overdue: { type: "integer" },
      },
      required: ["totalRequisitions", "estimatedHours", "deliveredOnTime", "overdue"],
      additionalProperties: false,
    },
  },
  required: ["companyId", "year", "months", "indicators"],
  additionalProperties: false,
} as const;

const assignee = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
  },
  required: ["id", "name"],
  additionalProperties: false,
} as const;

const timelineTask = {
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
    startDate: { type: ["string", "null"], format: "date" },
    plannedEndDate: { type: ["string", "null"], format: "date" },
    completedAt: { type: ["string", "null"], format: "date-time" },
    isOverdue: { type: "boolean" },
    isPaused: { type: "boolean" },
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
    "isOverdue",
    "isPaused",
  ],
  additionalProperties: false,
} as const;

const weeklyResponse = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    weekStart: { type: "string", format: "date" },
    weekEnd: { type: "string", format: "date" },
    days: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          isBusinessDay: { type: "boolean", const: true },
          tasks: { type: "array", items: timelineTask },
        },
        required: ["date", "isBusinessDay", "tasks"],
        additionalProperties: false,
      },
    },
    undatedTasks: { type: "array", items: timelineTask },
    overdueTasks: { type: "array", items: timelineTask },
    weekendTasks: { type: "array", items: timelineTask },
    assignees: { type: "array", items: assignee },
  },
  required: [
    "companyId",
    "weekStart",
    "weekEnd",
    "days",
    "undatedTasks",
    "overdueTasks",
    "weekendTasks",
    "assignees",
  ],
  additionalProperties: false,
} as const;

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

function assertAllowedQuery(request: FastifyRequest): void {
  const query = request.url.split("?", 2)[1];
  if (!query) return;
  const keys = query.split("&").map((part) => decodeURIComponent(part.split("=", 1)[0] ?? ""));
  if (keys.some((key) => !["weekStart", "assigneeId", "status", "priority"].includes(key))) {
    throw new ValidationError("Entrada inválida");
  }
}

function assertAllowedMonthlyQuery(request: FastifyRequest): void {
  const query = request.url.split("?", 2)[1];
  if (!query) return;
  const keys = query.split("&").map((part) => decodeURIComponent(part.split("=", 1)[0] ?? ""));
  if (keys.some((key) => !["period", "assigneeId", "status", "priority"].includes(key))) {
    throw new ValidationError("Entrada inválida");
  }
}

function assertAllowedYearlyQuery(request: FastifyRequest): void {
  const query = request.url.split("?", 2)[1];
  if (!query) return;
  const keys = query.split("&").map((part) => decodeURIComponent(part.split("=", 1)[0] ?? ""));
  if (keys.some((key) => !["year", "assigneeId", "status", "priority"].includes(key))) {
    throw new ValidationError("Entrada inválida");
  }
}

export async function registerTimelineRoutes(
  app: FastifyInstance,
  options: TimelineRouteOptions,
): Promise<void> {
  app.get(
    "/companies/:companyId/timeline/monthly",
    {
      schema: {
        tags: ["Timeline"],
        description: "Obtém a timeline mensal de requisições da empresa.",
        headers: userHeader,
        params: companyParams,
        querystring: monthlyQuery,
        response: {
          200: monthlyResponse,
          400: { description: "Entrada inválida.", ...errorResponse },
          401: { description: "Usuário não autenticado.", ...errorResponse },
          403: { description: "Acesso ou permissão insuficiente.", ...errorResponse },
          404: { description: "Empresa não encontrada.", ...errorResponse },
        },
      },
    },
    async (request) => {
      assertAllowedMonthlyQuery(request);
      const { companyId } = request.params as { companyId: string };
      const query = request.query as {
        period: string;
        priority?: "LOW" | "MEDIUM" | "HIGH";
        assigneeId?: string;
        status?: "OPEN" | "IN_PROGRESS" | "PAUSED" | "DONE" | "CANCELLED";
      };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.getMonthly.execute({
        actor,
        companyId,
        period: query.period,
        filters: {
          priority: query.priority,
          assigneeId: query.assigneeId,
          status: query.status,
        },
      });
    },
  );

  app.get(
    "/companies/:companyId/timeline/yearly",
    {
      schema: {
        tags: ["Timeline"],
        description: "Obtém a timeline anual de requisições da empresa.",
        headers: userHeader,
        params: companyParams,
        querystring: yearlyQuery,
        response: {
          200: yearlyResponse,
          400: { description: "Entrada inválida.", ...errorResponse },
          401: { description: "Usuário não autenticado.", ...errorResponse },
          403: { description: "Acesso ou permissão insuficiente.", ...errorResponse },
          404: { description: "Empresa não encontrada.", ...errorResponse },
        },
      },
    },
    async (request) => {
      assertAllowedYearlyQuery(request);
      const { companyId } = request.params as { companyId: string };
      const query = request.query as {
        year: string;
        priority?: "LOW" | "MEDIUM" | "HIGH";
        assigneeId?: string;
        status?: "OPEN" | "IN_PROGRESS" | "PAUSED" | "DONE" | "CANCELLED";
      };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.getYearly.execute({
        actor,
        companyId,
        year: query.year,
        filters: {
          priority: query.priority,
          assigneeId: query.assigneeId,
          status: query.status,
        },
      });
    },
  );

  app.get(
    "/companies/:companyId/timeline/weekly",
    {
      schema: {
        tags: ["Timeline"],
        description: "Obtém a timeline semanal de tarefas da empresa.",
        headers: userHeader,
        params: companyParams,
        querystring: weeklyQuery,
        response: {
          200: weeklyResponse,
          400: { description: "Entrada inválida.", ...errorResponse },
          401: { description: "Usuário não autenticado.", ...errorResponse },
          403: { description: "Acesso ou permissão insuficiente.", ...errorResponse },
          404: { description: "Empresa não encontrada.", ...errorResponse },
        },
      },
    },
    async (request) => {
      assertAllowedQuery(request);
      const { companyId } = request.params as { companyId: string };
      const query = request.query as {
        weekStart: string;
        assigneeId?: string;
        status?: "TODO" | "IN_PROGRESS" | "PAUSED" | "DONE";
        priority?: "LOW" | "MEDIUM" | "HIGH";
      };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.getWeekly.execute({
        actor,
        companyId,
        weekStart: query.weekStart,
        filters: {
          assigneeId: query.assigneeId,
          status: query.status,
          priority: query.priority,
        },
      });
    },
  );
}
