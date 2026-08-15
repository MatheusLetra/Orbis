import type { FastifyInstance, FastifyRequest } from "fastify";
import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { CreateCompanyMember } from "@/modules/memberships/application/use-cases/create-company-member";
import type { CreateMembership } from "@/modules/memberships/application/use-cases/create-membership";
import type { ListCompanyMembers } from "@/modules/memberships/application/use-cases/list-company-members";
import type { ListCompanyMemberships } from "@/modules/memberships/application/use-cases/list-company-memberships";
import type { ListMemberships } from "@/modules/memberships/application/use-cases/list-memberships";
import type { UpdateMembershipPermissions } from "@/modules/memberships/application/use-cases/update-membership-permissions";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import { PERMISSIONS } from "@/modules/permissions/domain/permission";
import { ROLES } from "@/modules/permissions/domain/role";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface MembershipRouteOptions {
  createMembership: CreateMembership;
  createCompanyMember: CreateCompanyMember;
  listCompanyMembers: ListCompanyMembers;
  listCompanyMemberships: ListCompanyMemberships;
  listMemberships: ListMemberships;
  updateMembershipPermissions: UpdateMembershipPermissions;
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
    permissions: { type: "array", items: { type: "string", enum: PERMISSIONS } },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "companyId",
    "userId",
    "position",
    "permissions",
    "isActive",
    "createdAt",
    "updatedAt",
  ],
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

const companyMembershipParams = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    membershipId: { type: "string", format: "uuid" },
  },
  required: ["companyId", "membershipId"],
  additionalProperties: false,
} as const;

const companyMembershipResponse = {
  ...membershipResponse,
  properties: {
    ...membershipResponse.properties,
    name: { type: "string" },
    email: { type: "string", format: "email" },
    userIsActive: { type: "boolean" },
  },
  required: [...membershipResponse.required, "name", "email", "userIsActive"],
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
    "/companies/:companyId/memberships",
    {
      schema: {
        tags: ["Memberships"],
        description: "Lista memberships e usuários da empresa para administração.",
        headers: userHeader,
        params: companyParams,
        response: { 200: { type: "array", items: companyMembershipResponse } },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.listCompanyMemberships.execute({ actor });
    },
  );

  app.post(
    "/companies/:companyId/members",
    {
      schema: {
        tags: ["Memberships"],
        description: "Cria atomicamente um usuário e sua membership na empresa.",
        headers: userHeader,
        params: companyParams,
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email", maxLength: 320 },
            name: { type: "string", minLength: 1, maxLength: 200 },
            password: { type: "string", minLength: 8, maxLength: 200 },
            position: { type: "string", enum: ROLES },
          },
          required: ["email", "name", "password", "position"],
          additionalProperties: false,
        },
        response: { 201: companyMembershipResponse },
      },
    },
    async (request, reply) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      const output = await options.createCompanyMember.execute({
        actor,
        data: request.body as never,
      });
      return reply.status(201).send(output);
    },
  );

  app.patch(
    "/companies/:companyId/memberships/:membershipId/permissions",
    {
      schema: {
        tags: ["Memberships"],
        description: "Substitui as permissões adicionais de uma membership.",
        headers: userHeader,
        params: companyMembershipParams,
        body: {
          type: "object",
          properties: {
            permissions: {
              type: "array",
              items: { type: "string", enum: PERMISSIONS },
              uniqueItems: true,
            },
          },
          required: ["permissions"],
          additionalProperties: false,
        },
        response: { 200: membershipResponse },
      },
    },
    async (request) => {
      const { companyId, membershipId } = request.params as {
        companyId: string;
        membershipId: string;
      };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.updateMembershipPermissions.execute({
        actor,
        membershipId,
        data: request.body as never,
      });
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
