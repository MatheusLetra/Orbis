import type { FastifyInstance } from "fastify";
import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { CreateMembership } from "@/modules/memberships/application/use-cases/create-membership";
import type { ListMemberships } from "@/modules/memberships/application/use-cases/list-memberships";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";

export interface MembershipRouteOptions {
  createMembership: CreateMembership;
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
