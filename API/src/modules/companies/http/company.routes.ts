import type { FastifyInstance } from "fastify";
import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { CreateCompany } from "@/modules/companies/application/use-cases/create-company";
import type { GetCompany } from "@/modules/companies/application/use-cases/get-company";
import type { ListCompanies } from "@/modules/companies/application/use-cases/list-companies";
import type { UpdateCompany } from "@/modules/companies/application/use-cases/update-company";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import type { Permission } from "@/modules/permissions/domain/permission";

export interface CompanyRouteOptions {
  createCompany: CreateCompany;
  getCompany: GetCompany;
  listCompanies: ListCompanies;
  updateCompany: UpdateCompany;
  permissionResolver: PermissionResolver;
}

const companyIdParam = {
  type: "object",
  properties: { companyId: { type: "string", format: "uuid" } },
  required: ["companyId"],
} as const;

const companyResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    timezone: { type: "string" },
    settings: { type: "object", additionalProperties: true },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "name", "timezone", "settings", "isActive", "createdAt", "updatedAt"],
} as const;

const userHeader = {
  type: "object",
  properties: {
    authorization: { type: "string", description: "Token de acesso: Bearer <token>" },
  },
} as const;

const companyListResponse = {
  type: "array",
  items: companyResponse,
} as const;

const EXPOSED_CAPABILITIES = [
  "tasks.create",
  "tasks.update",
  "kanban.manage",
  "hours.register",
  "capacity.read",
  "users.read",
  "requisitions.read",
] as const satisfies readonly Permission[];

const capabilitiesResponse = {
  type: "object",
  properties: {
    companyId: { type: "string", format: "uuid" },
    capabilities: {
      type: "object",
      properties: Object.fromEntries(
        EXPOSED_CAPABILITIES.map((capability) => [capability, { type: "boolean" }]),
      ),
      required: EXPOSED_CAPABILITIES,
      additionalProperties: false,
    },
  },
  required: ["companyId", "capabilities"],
  additionalProperties: false,
} as const;

export async function registerCompanyRoutes(
  app: FastifyInstance,
  options: CompanyRouteOptions,
): Promise<void> {
  app.post(
    "/companies",
    {
      schema: {
        tags: ["Empresas"],
        description: "Cria uma empresa e torna o usuário autenticado o gestor (membership GESTOR).",
        headers: userHeader,
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            timezone: { type: "string" },
            settings: { type: "object", additionalProperties: true },
          },
          required: ["name"],
        },
        response: { 201: companyResponse },
      },
    },
    async (request, reply) => {
      const output = await options.createCompany.execute({
        ownerId: getCurrentUserId(request),
        company: request.body as never,
      });
      return reply.status(201).send(output);
    },
  );

  app.get(
    "/companies",
    {
      schema: {
        tags: ["Empresas"],
        description: "Lista as empresas do usuário autenticado.",
        headers: userHeader,
        response: { 200: companyListResponse },
      },
    },
    async (request) => {
      return options.listCompanies.execute({ userId: getCurrentUserId(request) });
    },
  );

  app.get(
    "/companies/:companyId/capabilities",
    {
      schema: {
        tags: ["Empresas"],
        description: "Retorna as capabilities efetivas do usuário autenticado na empresa.",
        headers: userHeader,
        params: companyIdParam,
        response: { 200: capabilitiesResponse },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return {
        companyId,
        capabilities: Object.fromEntries(
          EXPOSED_CAPABILITIES.map((capability) => [
            capability,
            actor.permissions.includes(capability),
          ]),
        ),
      };
    },
  );

  app.get(
    "/companies/:companyId",
    {
      schema: {
        tags: ["Empresas"],
        description: "Obtém uma empresa pelo id (requer acesso).",
        headers: userHeader,
        params: companyIdParam,
        response: { 200: companyResponse },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.getCompany.execute({ actor, companyId });
    },
  );

  app.patch(
    "/companies/:companyId",
    {
      schema: {
        tags: ["Empresas"],
        description: "Atualiza parcialmente uma empresa (requer acesso).",
        headers: userHeader,
        params: companyIdParam,
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            timezone: { type: "string" },
            settings: { type: "object", additionalProperties: true },
          },
          additionalProperties: false,
        },
        response: { 200: companyResponse },
      },
    },
    async (request) => {
      const { companyId } = request.params as { companyId: string };
      const actor = await options.permissionResolver.resolve(getCurrentUserId(request), companyId);
      return options.updateCompany.execute({
        actor,
        companyId,
        changes: request.body as never,
      });
    },
  );
}
