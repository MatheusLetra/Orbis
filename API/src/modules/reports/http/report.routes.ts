import type { FastifyInstance, FastifyRequest } from "fastify";
import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import {
  EXPORT_LIMIT,
  taskReportQuerySchema,
} from "@/modules/reports/application/dto/task-report-dtos";
import { taskReportToCsv } from "@/modules/reports/application/services/task-report-csv";
import type { GetTaskReport } from "@/modules/reports/application/use-cases/get-task-report";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface ReportRouteOptions {
  getTaskReport: GetTaskReport;
  permissionResolver: PermissionResolver;
}
const params = {
  type: "object",
  properties: { companyId: { type: "string", format: "uuid" } },
  required: ["companyId"],
  additionalProperties: false,
} as const;
const query = {
  type: "object",
  properties: {
    periodStart: { type: "string", format: "date" },
    periodEnd: { type: "string", format: "date" },
    requisitionId: { type: "string", format: "uuid" },
    employeeId: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
  },
  additionalProperties: false,
} as const;
const error = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: { code: { type: "string" }, message: { type: "string" } },
      required: ["code", "message"],
    },
  },
  required: ["error"],
} as const;
const reportItem = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    status: { type: "string", enum: ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    issuedAt: { type: "string", format: "date-time" },
    plannedEndDate: { type: ["string", "null"], format: "date" },
    completedAt: { type: ["string", "null"], format: "date-time" },
    assigneeId: { type: ["string", "null"], format: "uuid" },
    assigneeName: { type: ["string", "null"] },
    requisitionId: { type: ["string", "null"], format: "uuid" },
    requisitionNumber: { type: ["integer", "null"] },
    requisitionTitle: { type: ["string", "null"] },
    estimatedHours: { type: ["number", "null"] },
    workedHours: { type: "number", minimum: 0 },
  },
  required: [
    "id",
    "title",
    "status",
    "priority",
    "issuedAt",
    "plannedEndDate",
    "completedAt",
    "assigneeId",
    "assigneeName",
    "requisitionId",
    "requisitionNumber",
    "requisitionTitle",
    "estimatedHours",
    "workedHours",
  ],
  additionalProperties: false,
} as const;
const reportResponse = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    items: { type: "array", items: reportItem },
    total: { type: "integer", minimum: 0 },
    page: { type: "integer", minimum: 1 },
    limit: { type: "integer", minimum: 1 },
    hasMore: { type: "boolean" },
  },
  required: ["companyId", "items", "total", "page", "limit", "hasMore"],
  additionalProperties: false,
} as const;

function allowed(request: FastifyRequest, keys: string[]) {
  const raw = request.url.split("?", 2)[1];
  if (
    raw?.split("&").some((part) => !keys.includes(decodeURIComponent(part.split("=", 1)[0] ?? "")))
  )
    throw new ValidationError("Entrada inválida");
}
function parse(request: FastifyRequest) {
  const result = taskReportQuerySchema.safeParse(request.query);
  if (!result.success)
    throw new ValidationError("Filtros do relatório inválidos", {
      details: { issues: result.error.issues },
    });
  return result.data;
}

export async function registerReportRoutes(
  app: FastifyInstance,
  options: ReportRouteOptions,
): Promise<void> {
  const handler = async (request: FastifyRequest) => {
    const { companyId } = request.params as { companyId: string };
    const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
    return options.getTaskReport.execute({ actor, companyId, filters: parse(request) });
  };
  app.get(
    "/companies/:companyId/reports/tasks",
    {
      schema: {
        tags: ["Relatórios"],
        description:
          "Relatório paginado de Tasks. O período é inclusivo por interseção; datas são calendário.",
        params,
        querystring: query,
        response: {
          200: reportResponse,
          400: error,
          401: error,
          403: error,
          404: error,
          422: error,
          500: error,
        },
      },
    },
    async (request) => {
      allowed(request, [
        "periodStart",
        "periodEnd",
        "requisitionId",
        "employeeId",
        "status",
        "priority",
        "page",
        "limit",
      ]);
      return handler(request);
    },
  );
  app.get(
    "/companies/:companyId/reports/tasks/export",
    {
      schema: {
        tags: ["Relatórios"],
        description: `Exporta o relatório completo em CSV. Limite máximo: ${EXPORT_LIMIT.toLocaleString("pt-BR")} Tasks.`,
        params,
        querystring: {
          type: "object",
          properties: {
            periodStart: { type: "string", format: "date" },
            periodEnd: { type: "string", format: "date" },
            requisitionId: { type: "string", format: "uuid" },
            employeeId: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] },
            priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          },
          additionalProperties: false,
        },
        response: {
          200: { type: "string", description: "CSV UTF-8", contentType: "text/csv" },
          400: error,
          401: error,
          403: error,
          404: error,
          422: error,
          500: error,
        },
      },
    },
    async (request, reply) => {
      allowed(request, [
        "periodStart",
        "periodEnd",
        "requisitionId",
        "employeeId",
        "status",
        "priority",
      ]);
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      const filters = parse(request);
      const first = await options.getTaskReport.execute({
        actor,
        companyId,
        filters: { ...filters, page: 1, limit: 100 },
      });
      if (first.total > EXPORT_LIMIT)
        throw new ValidationError(`A exportação excede o limite de ${EXPORT_LIMIT} Tasks`);
      const items = [...first.items];
      for (let page = 2; items.length < first.total; page += 1) {
        const next = await options.getTaskReport.execute({
          actor,
          companyId,
          filters: { ...filters, page, limit: 100 },
        });
        items.push(...next.items);
        if (next.items.length === 0) break;
      }
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="orbis-task-report-${companyId}.csv"`)
        .send(taskReportToCsv(items));
    },
  );
}
