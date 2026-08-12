import type { FastifyInstance, FastifyRequest } from "fastify";
import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { CreateMembership } from "@/modules/memberships/application/use-cases/create-membership";
import type { ListCompanyMembers } from "@/modules/memberships/application/use-cases/list-company-members";
import type { ListMemberships } from "@/modules/memberships/application/use-cases/list-memberships";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface MembershipRouteOptions {
  createMembership: CreateMembership;
  listCompanyMembers: ListCompanyMembers;
  listMemberships: ListMemberships;
  permissionResolver: PermissionResolver;
}

const userHeader = {
  type: "object",
  properties: {
    authorization: { type: "string", description: "Token de acesso: Bearer <token>" },
  },
} as const;

const membershipResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    userId: { type: "string" },
    position: { type: "string" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "companyId", "userId", "position", "isActive", "createdAt", "updatedAt"],
} as const;

const membershipListResponse = {
  type: "array",
  items: membershipResponse,
} as const;

const companyMemberListQuery = {
  type: "object",
  properties: { search: { type: "string", maxLength: 200 } },
  additionalProperties: false,
} as const;

const companyMemberListResponse = {
  type: "array",
  items: {
    type: "object",
    properties: {
      userId: { type: "string", format: "uuid" },
      name: { type: "string" },
    },
    required: ["userId", "name"],
    additionalProperties: false,
  },
} as const;

const companyParams = {
  type: "object",
  properties: { companyId: { type: "string", format: "uuid" } },
  required: ["companyId"],
  additionalProperties: false,
} as const;

function assertAllowedQuery(request: FastifyRequest, allowed: readonly string[]): void {
  const query = request.url.split("?", 2)[1];
  if (!query) return;
  const keys = query.split("&").map((part) => decodeURIComponent(part.split("=", 1)[0] ?? ""));
  if (keys.some((key) => !allowed.includes(key))) {
    throw new ValidationError("Entrada inválida");
  }
}

export async function registerMembershipRoutes(
  app: FastifyInstance,
  options: MembershipRouteOptions,
): Promise<void> {
  app.post(
    "/memberships",
    {
      schema: {
        tags: ["Memberships"],
        description: "Vincula um usuário a uma empresa com um cargo.",
        headers: userHeader,
        body: {
          type: "object",
          properties: {
            companyId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            position: { type: "string" },
          },
          required: ["companyId", "userId", "position"],
        },
        response: { 201: membershipResponse },
      },
    },
    async (request, reply) => {
      const body = request.body as { companyId: string };
      const actor = await options.permissionResolver.resolve(
        getCurrentUserId(request),
        body.companyId,
      );
      const output = await options.createMembership.execute({
        actor,
        data: request.body as never,
      });
      return reply.status(201).send(output);
    },
  );

  app.get(
    "/companies/:companyId/members",
    {
      schema: {
        tags: ["Memberships"],
        description: "Lista membros ativos da empresa para seleção de responsáveis.",
        headers: userHeader,
        params: companyParams,
        querystring: companyMemberListQuery,
        response: { 200: companyMemberListResponse },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      assertAllowedQuery(request, ["search"]);
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.listCompanyMembers.execute({
        actor,
        search: (request.query as { search?: string }).search,
      });
    },
  );

  app.get(
    "/memberships",
    {
      schema: {
        tags: ["Memberships"],
        description: "Lista as memberships do usuário autenticado.",
        headers: userHeader,
        response: { 200: membershipListResponse },
      },
    },
    async (request) => {
      return options.listMemberships.execute({ userId: getCurrentUserId(request) });
    },
  );
}
