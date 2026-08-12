import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const TASK_ID = "44444444-4444-4444-8444-444444444444";

async function build(): Promise<{ app: FastifyInstance; modules: TestModules }> {
  const modules = buildTestModules();
  const app = await buildApp({ logger: false, modules });
  return { app, modules };
}

async function authHeaders(modules: TestModules) {
  return { authorization: `Bearer ${await modules.tokenService.signAccessToken(USER_ID)}` };
}

async function seedActor(modules: TestModules, active = true, position = "GESTOR") {
  await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
  const membership = Membership.create({
    companyId: COMPANY_ID,
    userId: USER_ID,
    position,
  });
  if (!active) membership.deactivate();
  await modules.repositories.memberships.create(membership);
}

describe("Task HTTP integration", () => {
  it("documenta as cinco rotas de Tasks no OpenAPI", async () => {
    const { app } = await build();
    await app.ready();
    const paths = app.swagger().paths;

    expect(paths).toHaveProperty("/companies/{companyId}/tasks");
    expect(paths).toHaveProperty("/companies/{companyId}/tasks/{taskId}");
    expect(paths["/companies/{companyId}/tasks"]?.post?.responses).toHaveProperty("201");
    expect(paths["/companies/{companyId}/tasks"]?.get?.responses).toHaveProperty("200");
    expect(paths["/companies/{companyId}/tasks/{taskId}"]?.get?.responses).toHaveProperty("200");
    expect(paths["/companies/{companyId}/tasks/{taskId}"]?.patch?.responses).toHaveProperty("200");
    expect(paths["/companies/{companyId}/tasks/{taskId}/status"]?.patch?.responses).toHaveProperty(
      "200",
    );

    const createBody =
      paths["/companies/{companyId}/tasks"]?.post?.requestBody?.content?.["application/json"]
        ?.schema;
    expect(createBody).toMatchObject({
      additionalProperties: false,
      properties: {
        title: expect.any(Object),
        description: expect.any(Object),
        priority: expect.any(Object),
        assigneeId: expect.any(Object),
        requisitionId: expect.any(Object),
        startDate: expect.any(Object),
        plannedEndDate: expect.any(Object),
      },
    });
    expect(Object.keys(createBody.properties)).toEqual([
      "title",
      "description",
      "priority",
      "assigneeId",
      "requisitionId",
      "startDate",
      "plannedEndDate",
    ]);

    const listQuery = paths["/companies/{companyId}/tasks"]?.get?.parameters;
    expect(listQuery).toHaveLength(8);
    expect(
      listQuery?.filter((parameter) => parameter.in === "query").map((parameter) => parameter.name),
    ).toEqual(["scope", "status", "priority", "assigneeId", "requisitionId", "search"]);
    expect(listQuery?.find((parameter) => parameter.name === "scope")).toMatchObject({
      schema: { enum: ["company", "own"], default: "company" },
    });
    expect(listQuery?.find((parameter) => parameter.name === "search")).toMatchObject({
      schema: { maxLength: 200 },
    });

    const updateBody =
      paths["/companies/{companyId}/tasks/{taskId}"]?.patch?.requestBody?.content?.[
        "application/json"
      ]?.schema;
    expect(updateBody).toMatchObject({ additionalProperties: false });
    expect(Object.keys(updateBody.properties)).toEqual([
      "title",
      "description",
      "priority",
      "assigneeId",
      "requisitionId",
      "startDate",
      "plannedEndDate",
    ]);
    expect(updateBody.properties).not.toHaveProperty("status");
    expect(updateBody.properties).not.toHaveProperty("completedAt");

    const statusBody =
      paths["/companies/{companyId}/tasks/{taskId}/status"]?.patch?.requestBody?.content?.[
        "application/json"
      ]?.schema;
    expect(statusBody).toMatchObject({
      additionalProperties: false,
      properties: { status: expect.any(Object) },
    });
    expect(Object.keys(statusBody.properties)).toEqual(["status"]);
    expect(statusBody.properties).not.toHaveProperty("occurredAt");
    expect(statusBody.properties).not.toHaveProperty("changedAt");
    expect(statusBody.properties).not.toHaveProperty("metadata");
    await app.close();
  });

  it("cria, lista, atualiza, transiciona e consulta Task com histórico", async () => {
    const { app, modules } = await build();
    await seedActor(modules);
    const headers = await authHeaders(modules);

    const created = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY_ID}/tasks`,
      headers,
      payload: { title: "Nova tarefa", startDate: "2026-08-12T00:00:00.000Z" },
    });
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id;
    expect(created.json()).toMatchObject({ companyId: COMPANY_ID, status: "TODO" });

    const listed = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/tasks?status=TODO`,
      headers,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);
    expect(listed.json()[0]).not.toHaveProperty("history");

    const updated = await app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY_ID}/tasks/${taskId}`,
      headers,
      payload: { title: "Atualizada", description: null },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().title).toBe("Atualizada");

    const transitioned = await app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY_ID}/tasks/${taskId}/status`,
      headers,
      payload: { status: "IN_PROGRESS" },
    });
    expect(transitioned.statusCode).toBe(200);
    expect(transitioned.json().status).toBe("IN_PROGRESS");

    const detail = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/tasks/${taskId}`,
      headers,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().history).toHaveLength(2);
    expect(detail.json().history[0].fromStatus).toBeNull();
    expect(detail.json().history[1].toStatus).toBe("IN_PROGRESS");
    await app.close();
  });

  it("rejeita campos controlados, filtros extras e UUID inválido", async () => {
    const { app, modules } = await build();
    await seedActor(modules);
    const headers = await authHeaders(modules);

    await expect(
      app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks`,
        headers,
        payload: { title: "Tarefa", status: "DONE" },
      }),
    ).resolves.toMatchObject({ statusCode: 400 });

    await expect(
      app.inject({
        method: "GET",
        url: `/companies/${COMPANY_ID}/tasks?page=1`,
        headers,
      }),
    ).resolves.toMatchObject({ statusCode: 400 });

    await expect(
      app.inject({
        method: "PATCH",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/status`,
        headers,
        payload: { status: "IN_PROGRESS", occurredAt: "2026-08-12T12:00:00Z" },
      }),
    ).resolves.toMatchObject({ statusCode: 400 });

    await expect(
      app.inject({ method: "GET", url: "/companies/not-uuid/tasks", headers }),
    ).resolves.toMatchObject({ statusCode: 400 });

    await expect(
      app.inject({
        method: "GET",
        url: `/companies/${COMPANY_ID}/tasks?scope=own&assigneeId=55555555-5555-4555-8555-555555555555`,
        headers,
      }),
    ).resolves.toMatchObject({ statusCode: 400 });
    await app.close();
  });

  it("retorna erros de autenticação, permissão, membership e inexistência", async () => {
    const unauthenticated = await build();
    await expect(
      unauthenticated.app.inject({ method: "GET", url: `/companies/${COMPANY_ID}/tasks` }),
    ).resolves.toMatchObject({ statusCode: 401 });
    await unauthenticated.app.close();

    const forbidden = await build();
    await seedActor(forbidden.modules, true, "SEM_PERMISSAO");
    await expect(
      forbidden.app.inject({
        method: "GET",
        url: `/companies/${COMPANY_ID}/tasks`,
        headers: await authHeaders(forbidden.modules),
      }),
    ).resolves.toMatchObject({ statusCode: 403 });
    await forbidden.app.close();

    const inactive = await build();
    await seedActor(inactive.modules, false);
    await expect(
      inactive.app.inject({
        method: "GET",
        url: `/companies/${COMPANY_ID}/tasks`,
        headers: await authHeaders(inactive.modules),
      }),
    ).resolves.toMatchObject({ statusCode: 403 });
    await inactive.app.close();

    const missing = await build();
    await seedActor(missing.modules);
    await expect(
      missing.app.inject({
        method: "GET",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}`,
        headers: await authHeaders(missing.modules),
      }),
    ).resolves.toMatchObject({ statusCode: 404 });
    await missing.app.close();
  });
});
