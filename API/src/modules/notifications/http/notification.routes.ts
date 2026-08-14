import type { FastifyInstance } from "fastify";
import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { GetNotificationPreferences } from "@/modules/notifications/application/use-cases/get-notification-preferences";
import type { ListNotifications } from "@/modules/notifications/application/use-cases/list-notifications";
import type { MarkNotificationRead } from "@/modules/notifications/application/use-cases/mark-notification-read";
import type { UpdateNotificationPreference } from "@/modules/notifications/application/use-cases/update-notification-preference";
import { NOTIFICATION_EVENT_TYPES } from "@/modules/notifications/domain/notification-event";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import { ValidationError } from "@/shared/errors/typed-errors";

const headers = { type: "object", properties: { authorization: { type: "string" } } } as const;
const companyParams = {
  type: "object",
  properties: { companyId: { type: "string", format: "uuid" } },
  required: ["companyId"],
  additionalProperties: false,
} as const;
const item = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    companyId: { type: "string", format: "uuid" },
    userId: { type: "string", format: "uuid" },
    type: { type: "string", enum: NOTIFICATION_EVENT_TYPES },
    title: { type: "string" },
    body: { type: ["string", "null"] },
    readAt: { type: ["string", "null"], format: "date-time" },
    data: { type: ["object", "null"], additionalProperties: true },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["id", "companyId", "userId", "type", "title", "body", "readAt", "data", "createdAt"],
  additionalProperties: false,
} as const;
const preference = {
  type: "object",
  properties: {
    eventType: { type: "string", enum: NOTIFICATION_EVENT_TYPES },
    inAppEnabled: { type: "boolean" },
  },
  required: ["eventType", "inAppEnabled"],
  additionalProperties: false,
} as const;

function assertExactKeys(value: unknown, expected: readonly string[]): void {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !expected.includes(key))
  ) {
    throw new ValidationError("Entrada inválida");
  }
}

function assertNoBody(value: unknown): void {
  if (value !== undefined) throw new ValidationError("Entrada inválida");
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
const errorResponses = {
  400: { ...errorResponse, description: "Parâmetros ou payload inválidos." },
  401: { ...errorResponse, description: "Token de acesso ausente ou inválido." },
  403: { ...errorResponse, description: "Usuário sem membership ativa na empresa." },
  404: { ...errorResponse, description: "Recurso não encontrado no tenant do usuário." },
  422: { ...errorResponse, description: "Regra de negócio não satisfeita." },
} as const;

export interface NotificationRouteOptions {
  list: ListNotifications;
  markRead: MarkNotificationRead;
  getPreferences: GetNotificationPreferences;
  updatePreference: UpdateNotificationPreference;
  permissionResolver: PermissionResolver;
}

export async function registerNotificationRoutes(
  app: FastifyInstance,
  options: NotificationRouteOptions,
): Promise<void> {
  app.get(
    "/companies/:companyId/notifications",
    {
      preValidation: async (request) => assertExactKeys(request.query, ["limit"]),
      schema: {
        tags: ["Notifications"],
        description: "Lista as notificações do usuário autenticado na empresa.",
        headers,
        params: companyParams,
        querystring: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          additionalProperties: false,
        },
        response: {
          200: {
            description: "Notificações, total não lido e indicador de próxima página.",
            type: "object",
            properties: {
              items: { type: "array", items: item },
              unreadCount: { type: "integer" },
              hasMore: { type: "boolean" },
            },
            required: ["items", "unreadCount", "hasMore"],
            additionalProperties: false,
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.list.execute({ actor, limit: (request.query as { limit?: number }).limit });
    },
  );

  app.patch(
    "/companies/:companyId/notifications/:notificationId/read",
    {
      preValidation: async (request) => assertNoBody(request.body),
      schema: {
        tags: ["Notifications"],
        description: "Marca uma notificação do usuário autenticado como lida.",
        headers,
        params: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            notificationId: { type: "string", format: "uuid" },
          },
          required: ["companyId", "notificationId"],
          additionalProperties: false,
        },
        response: {
          200: { ...item, description: "Notificação marcada como lida." },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { companyId, notificationId } = request.params as {
        companyId: string;
        notificationId: string;
      };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.markRead.execute({ actor, notificationId });
    },
  );

  app.get(
    "/companies/:companyId/notification-preferences",
    {
      schema: {
        tags: ["Notifications"],
        description: "Retorna preferências efetivas, incluindo os defaults não persistidos.",
        headers,
        params: companyParams,
        response: {
          200: {
            description: "Preferências efetivas para todos os eventos suportados.",
            type: "object",
            properties: { items: { type: "array", items: preference } },
            required: ["items"],
            additionalProperties: false,
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.getPreferences.execute({ actor });
    },
  );

  app.patch(
    "/companies/:companyId/notification-preferences",
    {
      preValidation: async (request) =>
        assertExactKeys(request.body, ["eventType", "inAppEnabled"]),
      schema: {
        tags: ["Notifications"],
        description: "Atualiza uma preferência do usuário autenticado no tenant atual.",
        headers,
        params: companyParams,
        body: preference,
        response: {
          200: { ...preference, description: "Preferência atualizada." },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.updatePreference.execute({ actor, data: request.body });
    },
  );
}
