import type { FastifyInstance, FastifyRequest } from "fastify";

import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { CalculateCapacity } from "@/modules/capacity/application/use-cases/calculate-capacity";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface CapacityRouteOptions {
  calculateCapacity: CalculateCapacity;
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

const capacityQuery = {
  type: "object",
  properties: {
    startDate: { type: "string", format: "date-time" },
    estimatedHours: { type: "number", minimum: 0 },
  },
  required: ["startDate", "estimatedHours"],
  additionalProperties: false,
} as const;

const capacityResponse = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    startDate: { type: "string", format: "date-time" },
    estimatedHours: { type: "number", minimum: 0 },
    availableDevelopers: { type: "integer", minimum: 0 },
    dailyHoursPerDeveloper: { type: "number", exclusiveMinimum: 0, maximum: 24 },
    dailyCapacity: { type: "number", exclusiveMinimum: 0 },
    requiredDays: { type: "number", minimum: 0 },
    plannedDeliveryDate: { type: "string", format: "date-time" },
  },
  required: [
    "companyId",
    "startDate",
    "estimatedHours",
    "availableDevelopers",
    "dailyHoursPerDeveloper",
    "dailyCapacity",
    "requiredDays",
    "plannedDeliveryDate",
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

function parseStartDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError("startDate inválida");
  return date;
}

function assertAllowedQuery(request: FastifyRequest): void {
  const query = request.url.split("?", 2)[1];
  if (!query) return;
  const keys = query.split("&").map((part) => decodeURIComponent(part.split("=", 1)[0] ?? ""));
  if (keys.some((key) => !["startDate", "estimatedHours"].includes(key))) {
    throw new ValidationError("Entrada inválida");
  }
}

function toCapacityResponse(output: Awaited<ReturnType<CalculateCapacity["execute"]>>) {
  return {
    ...output,
    startDate: output.startDate.toISOString(),
    plannedDeliveryDate: output.plannedDeliveryDate.toISOString(),
  };
}

export async function registerCapacityRoutes(
  app: FastifyInstance,
  options: CapacityRouteOptions,
): Promise<void> {
  app.get(
    "/companies/:companyId/capacity",
    {
      schema: {
        tags: ["Capacidade"],
        description: "Calcula a capacidade diária e a previsão de entrega da empresa.",
        headers: userHeader,
        params: companyParams,
        querystring: capacityQuery,
        response: {
          200: capacityResponse,
          400: { description: "Entrada inválida.", ...errorResponse },
          401: { description: "Usuário não autenticado.", ...errorResponse },
          403: { description: "Acesso ou permissão insuficiente.", ...errorResponse },
          404: { description: "Empresa não encontrada.", ...errorResponse },
          422: { description: "Capacidade não configurada ou indisponível.", ...errorResponse },
        },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      assertAllowedQuery(request);
      const query = request.query as { startDate: string; estimatedHours: number };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      const output = await options.calculateCapacity.execute({
        actor,
        companyId,
        startDate: parseStartDate(query.startDate),
        estimatedHours: query.estimatedHours,
      });
      return toCapacityResponse(output);
    },
  );
}
