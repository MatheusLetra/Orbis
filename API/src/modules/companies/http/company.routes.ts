import type { FastifyInstance } from "fastify";
import { getCurrentUserId } from "@/infrastructure/http/current-user";
import type { CreateCompany } from "@/modules/companies/application/use-cases/create-company";
import type { GetCompany } from "@/modules/companies/application/use-cases/get-company";
import type { ListCompanies } from "@/modules/companies/application/use-cases/list-companies";
import type { UpdateCompany } from "@/modules/companies/application/use-cases/update-company";

export interface CompanyRouteOptions {
  createCompany: CreateCompany;
  getCompany: GetCompany;
  listCompanies: ListCompanies;
  updateCompany: UpdateCompany;
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
      return options.getCompany.execute({
        userId: getCurrentUserId(request),
        companyId,
      });
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
      return options.updateCompany.execute({
        userId: getCurrentUserId(request),
        companyId,
        changes: request.body as never,
      });
    },
  );
}
