import type { FastifyInstance } from "fastify";
import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { CreateDirectConversation } from "@/modules/chat/application/use-cases/create-direct-conversation";
import type { ListConversations } from "@/modules/chat/application/use-cases/list-conversations";
import type { ListMessages } from "@/modules/chat/application/use-cases/list-messages";
import type { MarkConversationRead } from "@/modules/chat/application/use-cases/mark-conversation-read";
import type { SendMessage } from "@/modules/chat/application/use-cases/send-message";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import { ValidationError } from "@/shared/errors/typed-errors";

const headers = { type: "object", properties: { authorization: { type: "string" } } } as const;
const companyParams = {
  type: "object",
  properties: { companyId: { type: "string", format: "uuid" } },
  required: ["companyId"],
  additionalProperties: false,
} as const;
const conversationParams = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    conversationId: { type: "string", format: "uuid" },
  },
  required: ["companyId", "conversationId"],
  additionalProperties: false,
} as const;
const message = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    conversationId: { type: "string", format: "uuid" },
    senderId: { type: "string", format: "uuid" },
    body: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["id", "conversationId", "senderId", "body", "createdAt"],
  additionalProperties: false,
} as const;
const conversation = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    companyId: { type: "string", format: "uuid" },
    type: { type: "string", enum: ["direct"] },
    participants: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        properties: {
          userId: { type: "string", format: "uuid" },
          name: { type: "string" },
        },
        required: ["userId", "name"],
        additionalProperties: false,
      },
    },
    lastMessage: { anyOf: [message, { type: "null" }] },
    unreadCount: { type: "integer", minimum: 0 },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "companyId",
    "type",
    "participants",
    "lastMessage",
    "unreadCount",
    "createdAt",
    "updatedAt",
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
const inputError = {
  400: { ...errorResponse, description: "Parâmetros, query, cursor ou payload inválidos." },
} as const;
const authorizationErrors = {
  401: { ...errorResponse, description: "Token de acesso ausente ou inválido." },
  403: { ...errorResponse, description: "Empresa, membership ou permissão sem acesso." },
} as const;
const scopedErrors = {
  ...inputError,
  ...authorizationErrors,
  404: { ...errorResponse, description: "Conversa ou participante não encontrado no tenant." },
} as const;

export interface ChatRouteOptions {
  createConversation: CreateDirectConversation;
  listConversations: ListConversations;
  listMessages: ListMessages;
  sendMessage: SendMessage;
  markRead: MarkConversationRead;
  permissionResolver: PermissionResolver;
}

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

export async function registerChatRoutes(app: FastifyInstance, options: ChatRouteOptions) {
  app.post(
    "/companies/:companyId/conversations",
    {
      preValidation: async (request) => assertExactKeys(request.body, ["participantId"]),
      schema: {
        tags: ["Chat"],
        description: "Cria uma conversa direta entre o ator e um participante do mesmo tenant.",
        headers,
        params: companyParams,
        body: {
          type: "object",
          properties: { participantId: { type: "string", format: "uuid" } },
          required: ["participantId"],
          additionalProperties: false,
        },
        response: {
          201: { ...conversation, description: "Conversa direta criada." },
          ...scopedErrors,
          409: { ...errorResponse, description: "O par já possui uma conversa direta." },
          422: { ...errorResponse, description: "Regra de criação da conversa não satisfeita." },
        },
      },
    },
    async (request, reply) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      const output = await options.createConversation.execute({ actor, data: request.body });
      return reply.status(201).send(output);
    },
  );

  app.get(
    "/companies/:companyId/conversations",
    {
      preValidation: async (request) => assertExactKeys(request.query, []),
      schema: {
        tags: ["Chat"],
        description: "Lista somente as conversas diretas das quais o ator participa.",
        headers,
        params: companyParams,
        querystring: { type: "object", additionalProperties: false },
        response: {
          200: {
            description: "Conversas em ordem decrescente de atualização e id.",
            type: "object",
            properties: { items: { type: "array", items: conversation } },
            required: ["items"],
            additionalProperties: false,
          },
          ...inputError,
          ...authorizationErrors,
        },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.listConversations.execute({ actor });
    },
  );

  app.get(
    "/companies/:companyId/conversations/:conversationId/messages",
    {
      preValidation: async (request) => assertExactKeys(request.query, ["limit", "before"]),
      schema: {
        tags: ["Chat"],
        description: "Lista mensagens recentes ou anteriores por cursor opaco.",
        headers,
        params: conversationParams,
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            before: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            description: "Página em ordem crescente de data e id.",
            type: "object",
            properties: {
              items: { type: "array", items: message },
              hasMore: { type: "boolean" },
              nextCursor: { type: ["string", "null"] },
            },
            required: ["items", "hasMore", "nextCursor"],
            additionalProperties: false,
          },
          ...scopedErrors,
        },
      },
    },
    async (request) => {
      const { companyId, conversationId } = request.params as {
        companyId: string;
        conversationId: string;
      };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.listMessages.execute({ actor, conversationId, query: request.query });
    },
  );

  app.post(
    "/companies/:companyId/conversations/:conversationId/messages",
    {
      preValidation: async (request) => assertExactKeys(request.body, ["body"]),
      schema: {
        tags: ["Chat"],
        description: "Envia uma mensagem na conversa direta.",
        headers,
        params: conversationParams,
        body: {
          type: "object",
          properties: { body: { type: "string" } },
          required: ["body"],
          additionalProperties: false,
        },
        response: {
          201: { ...message, description: "Mensagem criada." },
          ...scopedErrors,
        },
      },
    },
    async (request, reply) => {
      const { companyId, conversationId } = request.params as {
        companyId: string;
        conversationId: string;
      };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      const output = await options.sendMessage.execute({
        actor,
        conversationId,
        data: request.body,
      });
      return reply.status(201).send(output);
    },
  );

  app.patch(
    "/companies/:companyId/conversations/:conversationId/read",
    {
      preValidation: async (request) => assertNoBody(request.body),
      schema: {
        tags: ["Chat"],
        description: "Marca como lidas as mensagens de terceiros existentes na conversa.",
        headers,
        params: conversationParams,
        response: {
          200: {
            description: "Estado de leitura atualizado de forma idempotente em efeito.",
            type: "object",
            properties: {
              conversationId: { type: "string", format: "uuid" },
              lastReadAt: { type: ["string", "null"], format: "date-time" },
              unreadCount: { type: "integer", enum: [0] },
            },
            required: ["conversationId", "lastReadAt", "unreadCount"],
            additionalProperties: false,
          },
          ...scopedErrors,
        },
      },
    },
    async (request) => {
      const { companyId, conversationId } = request.params as {
        companyId: string;
        conversationId: string;
      };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.markRead.execute({ actor, conversationId });
    },
  );
}
