import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { buildApp } from "@/app";
import {
  type RequisitionRouteOptions,
  registerRequisitionRoutes,
} from "@/modules/requisitions/http/requisition.routes";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError } from "@/shared/errors/typed-errors";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const REQUISITION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

function output() {
  return {
    id: REQUISITION_ID,
    companyId: COMPANY_ID,
    number: 1,
    title: "Requisição",
    description: null,
    priority: "MEDIUM",
    status: "OPEN",
    requesterId: USER_ID,
    responsibleId: null,
    systemId: null,
    systemVersionId: null,
    estimatedHours: null,
    startDate: null,
    plannedDeliveryDate: null,
    deliveredAt: null,
    createdAt: "2026-08-12T10:00:00.000Z",
    updatedAt: "2026-08-12T10:00:00.000Z",
  };
}

function buildOptions(): RequisitionRouteOptions & {
  calls: Record<string, unknown[]>;
  actor: AuthenticatedUser;
} {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, value: unknown) => {
    calls[name] ??= [];
    calls[name].push(value);
  };
  const actor = { userId: USER_ID, companyId: COMPANY_ID, permissions: [] } as AuthenticatedUser;
  const requisition = output();

  return {
    actor,
    calls,
    permissionResolver: {
      resolve: async (userId: string, companyId: string) => {
        record("resolve", { userId, companyId });
        return actor;
      },
    },
    create: {
      execute: async (input: unknown) => {
        record("create", input);
        return requisition;
      },
    } as never,
    update: {
      execute: async (input: unknown) => {
        record("update", input);
        return requisition;
      },
    } as never,
    list: {
      execute: async (input: unknown) => {
        record("list", input);
        return [requisition];
      },
    } as never,
    get: {
      execute: async (input: unknown) => {
        record("get", input);
        return { ...requisition, assignees: [] };
      },
    } as never,
    delete: {
      execute: async (input: unknown) => {
        record("delete", input);
        return { id: REQUISITION_ID };
      },
    } as never,
    addAssignee: {
      execute: async (input: unknown) => {
        record("addAssignee", input);
        return { userId: USER_ID, createdAt: "2026-08-12T10:00:00.000Z" };
      },
    } as never,
    removeAssignee: {
      execute: async (input: unknown) => {
        record("removeAssignee", input);
        return { requisitionId: REQUISITION_ID, userId: USER_ID };
      },
    } as never,
    listAssignees: {
      execute: async (input: unknown) => {
        record("listAssignees", input);
        return [];
      },
    } as never,
  };
}

async function build(
  options = buildOptions(),
): Promise<{ app: FastifyInstance; options: ReturnType<typeof buildOptions> }> {
  const app = await buildApp({ logger: false });
  app.addHook("preHandler", async (request) => {
    request.auth = { userId: USER_ID };
  });
  await registerRequisitionRoutes(app, options);
  return { app, options };
}

const headers = { authorization: "Bearer token" };
const jsonHeaders = { ...headers, "content-type": "application/json" };
const base = `/companies/${COMPANY_ID}/requisitions`;

describe("requisition routes", () => {
  it("registra as oito rotas", async () => {
    const { app } = await build();
    const routes = app.printRoutes();

    expect(routes).toContain("/requisitions (POST, GET, HEAD)");
    expect(routes).toContain(":requisitionId (GET, HEAD, PATCH, DELETE)");
    expect(routes).toContain("/assignees (POST, GET, HEAD)");
    expect(routes).toContain(":userId (DELETE)");
    await app.close();
  });

  it("resolve actor com companyId e cria com 201", async () => {
    const { app, options } = await build();
    const response = await app.inject({
      method: "POST",
      url: base,
      headers: jsonHeaders,
      payload: { title: "Nova", startDate: "2026-08-12T10:00:00.000Z" },
    });

    expect(response.statusCode).toBe(201);
    expect(options.calls.resolve).toEqual([{ userId: USER_ID, companyId: COMPANY_ID }]);
    expect(options.calls.create?.[0]).toMatchObject({ data: { startDate: expect.any(Date) } });
    await app.close();
  });

  it("lista sem equipe, obtém detalhe com equipe e executa update/delete", async () => {
    const { app, options } = await build();
    const list = await app.inject({ method: "GET", url: base, headers });
    const detail = await app.inject({ method: "GET", url: `${base}/${REQUISITION_ID}`, headers });
    const update = await app.inject({
      method: "PATCH",
      url: `${base}/${REQUISITION_ID}`,
      headers: jsonHeaders,
      payload: { title: "Atualizada" },
    });
    const deletion = await app.inject({
      method: "DELETE",
      url: `${base}/${REQUISITION_ID}`,
      headers,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json()[0]).not.toHaveProperty("assignees");
    expect(detail.statusCode).toBe(200);
    expect(detail.json().assignees).toEqual([]);
    expect(update.statusCode).toBe(200);
    expect(deletion.statusCode).toBe(200);
    expect(options.calls.update?.[0]).toMatchObject({ requisitionId: REQUISITION_ID });
    expect(options.calls.delete?.[0]).toMatchObject({ requisitionId: REQUISITION_ID });
    await app.close();
  });

  it("executa add/remove/list de assignees", async () => {
    const { app, options } = await build();
    const added = await app.inject({
      method: "POST",
      url: `${base}/${REQUISITION_ID}/assignees`,
      headers: jsonHeaders,
      payload: { userId: USER_ID },
    });
    const removed = await app.inject({
      method: "DELETE",
      url: `${base}/${REQUISITION_ID}/assignees/${USER_ID}`,
      headers,
    });
    const listed = await app.inject({
      method: "GET",
      url: `${base}/${REQUISITION_ID}/assignees`,
      headers: jsonHeaders,
    });

    expect(added.statusCode).toBe(200);
    expect(removed.statusCode).toBe(200);
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual([]);
    expect(options.calls.addAssignee?.[0]).toMatchObject({ userId: USER_ID });
    expect(options.calls.removeAssignee?.[0]).toMatchObject({ userId: USER_ID });
    await app.close();
  });

  it("valida UUIDs, body extra, query extra e companyId no body", async () => {
    const { app } = await build();
    const invalidParam = await app.inject({
      method: "GET",
      url: "/companies/not-uuid/requisitions",
      headers: jsonHeaders,
    });
    const invalidCreate = await app.inject({
      method: "POST",
      url: base,
      headers: jsonHeaders,
      payload: { companyId: COMPANY_ID },
    });
    const invalidPatch = await app.inject({
      method: "PATCH",
      url: `${base}/${REQUISITION_ID}`,
      headers: jsonHeaders,
      payload: { status: "DONE", nope: true },
    });
    const invalidQuery = await app.inject({ method: "GET", url: `${base}?search=test`, headers });

    expect(invalidParam.statusCode).toBe(400);
    expect(invalidCreate.statusCode).toBe(400);
    expect(invalidPatch.statusCode).toBe(400);
    expect(invalidQuery.statusCode).toBe(400);
    await app.close();
  });

  it("retorna 401 sem autenticação quando integrado ao app protegido", async () => {
    const options = buildOptions();
    const app = await buildApp({
      logger: false,
      modules: { ...({} as never), requisitions: options },
    });
    const response = await app.inject({ method: "GET", url: base });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("mapeia ForbiddenError pelo error handler", async () => {
    const options = buildOptions();
    options.permissionResolver.resolve = async () => {
      throw new ForbiddenError("Sem acesso");
    };
    const { app } = await build(options);
    const response = await app.inject({ method: "GET", url: base, headers });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });
});
