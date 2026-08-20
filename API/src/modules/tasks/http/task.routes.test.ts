import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { Task } from "@/modules/tasks/domain/entities/task";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_USER_ID = "55555555-5555-4555-8555-555555555555";

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

async function seedTask(modules: TestModules, assigneeId: string | null) {
  return modules.repositories.tasks.create(
    Task.restore({
      id: TASK_ID,
      companyId: COMPANY_ID,
      requisitionId: null,
      title: "Tarefa scoped",
      description: null,
      priority: "MEDIUM",
      status: "TODO",
      assigneeId,
      startDate: null,
      plannedEndDate: null,
      completedAt: null,
      createdAt: new Date("2026-08-12T10:00:00Z"),
      updatedAt: new Date("2026-08-12T10:00:00Z"),
    }),
  );
}

async function seedMember(modules: TestModules, userId: string) {
  await modules.repositories.memberships.create(
    Membership.create({ companyId: COMPANY_ID, userId, position: "DESENVOLVEDOR" }),
  );
}

describe("Task HTTP integration", () => {
  it("documenta as seis rotas de Tasks no OpenAPI", async () => {
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
    expect(
      paths["/companies/{companyId}/tasks/{taskId}/time-entries"]?.post?.responses,
    ).toHaveProperty("201");
    expect(
      paths["/companies/{companyId}/tasks/{taskId}/time-entries"]?.get?.responses,
    ).toHaveProperty("200");

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

    const timeEntryBody =
      paths["/companies/{companyId}/tasks/{taskId}/time-entries"]?.post?.requestBody?.content?.[
        "application/json"
      ]?.schema;
    expect(timeEntryBody).toMatchObject({
      additionalProperties: false,
      required: ["durationMinutes"],
      properties: {
        durationMinutes: { type: "integer", minimum: 1, maximum: 1440 },
        description: { maxLength: 1000 },
      },
    });
    expect(paths["/companies/{companyId}/tasks/{taskId}/time-entries"]?.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "query",
          name: "limit",
          schema: { minimum: 1, maximum: 100, default: 100, type: "integer" },
        }),
      ]),
    );
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

  it("aceita datas de calendário, persiste ambas sem deslocamento e rejeita datas inválidas", async () => {
    const { app, modules } = await build();
    await seedActor(modules);
    const headers = await authHeaders(modules);

    const created = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY_ID}/tasks`,
      headers,
      payload: {
        title: "Calendário",
        startDate: "2026-08-20",
        plannedEndDate: "2026-08-25",
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      startDate: "2026-08-20T00:00:00.000Z",
      plannedEndDate: "2026-08-25T00:00:00.000Z",
    });
    const stored = modules.repositories.tasks.items.get(created.json().id);
    expect(stored?.startDate?.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(stored?.plannedEndDate?.toISOString()).toBe("2026-08-25T00:00:00.000Z");

    await expect(
      app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks`,
        headers,
        payload: { title: "Inválida", startDate: "2026-02-30" },
      }),
    ).resolves.toMatchObject({ statusCode: 400 });
    await expect(
      app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks`,
        headers,
        payload: {
          title: "Invertida",
          startDate: "2026-08-25",
          plannedEndDate: "2026-08-20",
        },
      }),
    ).resolves.toMatchObject({ statusCode: 400 });
    await app.close();
  });

  it("reutiliza o PATCH de status para pausar e concluir com um único histórico por transição", async () => {
    const { app, modules } = await build();
    await seedActor(modules);
    await seedTask(modules, USER_ID);
    const headers = await authHeaders(modules);

    for (const status of ["IN_PROGRESS", "PAUSED", "DONE"] as const) {
      const response = await app.inject({
        method: "PATCH",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/status`,
        headers,
        payload: { status },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe(status);
    }

    const interval = [...modules.repositories.taskPauseIntervals.items.values()][0];
    expect(interval?.endedAt).toBeInstanceOf(Date);
    expect(interval?.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(modules.repositories.taskStatusHistory.items.map((item) => item.toStatus)).toEqual([
      "IN_PROGRESS",
      "PAUSED",
      "DONE",
    ]);
    await app.close();
  });

  it("registra TimeEntry no endpoint aninhado sem alterar a Task", async () => {
    const { app, modules } = await build();
    await seedActor(modules, true, "DESENVOLVEDOR");
    await seedTask(modules, USER_ID);
    const headers = await authHeaders(modules);

    const response = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/time-entries`,
      headers,
      payload: { durationMinutes: 90, description: "  Trabalho  " },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      companyId: COMPANY_ID,
      taskId: TASK_ID,
      userId: USER_ID,
      durationMinutes: 90,
      description: "Trabalho",
      startedAt: null,
      endedAt: null,
    });
    expect(modules.repositories.tasks.items.get(TASK_ID)?.status).toBe("TODO");
    expect(modules.repositories.taskStatusHistory.items).toHaveLength(0);
    await app.close();
  });

  it("aplica validação e autorização de TimeEntry", async () => {
    const own = await build();
    await seedActor(own.modules, true, "DESENVOLVEDOR");
    await seedTask(own.modules, USER_ID);
    const headers = await authHeaders(own.modules);
    await expect(
      own.app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/time-entries`,
        headers,
        payload: { durationMinutes: 0 },
      }),
    ).resolves.toMatchObject({ statusCode: 400 });
    await own.app.close();

    const denied = await build();
    await seedActor(denied.modules, true, "SUPORTE");
    await seedTask(denied.modules, USER_ID);
    await expect(
      denied.app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/time-entries`,
        headers: await authHeaders(denied.modules),
        payload: { durationMinutes: 1 },
      }),
    ).resolves.toMatchObject({ statusCode: 403 });
    await denied.app.close();

    const invalid = await build();
    await seedActor(invalid.modules, true, "DESENVOLVEDOR");
    await seedTask(invalid.modules, USER_ID);
    await expect(
      invalid.app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/time-entries`,
        headers: await authHeaders(invalid.modules),
        payload: { durationMinutes: 1, extra: true },
      }),
    ).resolves.toMatchObject({ statusCode: 400 });
    await invalid.app.close();
  });

  it("lista TimeEntries com total global e hasMore", async () => {
    const { app, modules } = await build();
    await seedActor(modules, true, "SUPORTE");
    await seedTask(modules, USER_ID);
    const { TimeEntry } = await import("@/modules/tasks/domain/entities/time-entry");
    await modules.repositories.timeEntries.create(
      TimeEntry.create({
        companyId: COMPANY_ID,
        taskId: TASK_ID,
        userId: USER_ID,
        durationMinutes: 30,
        createdAt: new Date("2026-08-13T10:00:00Z"),
      }),
    );
    await modules.repositories.timeEntries.create(
      TimeEntry.create({
        companyId: COMPANY_ID,
        taskId: TASK_ID,
        userId: USER_ID,
        durationMinutes: 45,
        createdAt: new Date("2026-08-13T11:00:00Z"),
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/time-entries?limit=1`,
      headers: await authHeaders(modules),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [{ durationMinutes: 30 }],
      totalDurationMinutes: 75,
      hasMore: true,
    });
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

  it("aplica alcance own/global em chamadas diretas de transição", async () => {
    const own = await build();
    await seedActor(own.modules, true, "DESENVOLVEDOR");
    await seedTask(own.modules, USER_ID);
    const ownResponse = await own.app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/status`,
      headers: await authHeaders(own.modules),
      payload: { status: "IN_PROGRESS" },
    });
    expect(ownResponse.statusCode).toBe(200);
    await own.app.close();

    for (const assigneeId of [OTHER_USER_ID, null]) {
      const denied = await build();
      await seedActor(denied.modules, true, "DESENVOLVEDOR");
      await seedTask(denied.modules, assigneeId);
      const response = await denied.app.inject({
        method: "PATCH",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/status`,
        headers: await authHeaders(denied.modules),
        payload: { status: "IN_PROGRESS" },
      });
      expect(response.statusCode).toBe(403);
      await denied.app.close();
    }

    const global = await build();
    await seedActor(global.modules, true, "GESTOR");
    await seedTask(global.modules, OTHER_USER_ID);
    const globalResponse = await global.app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/status`,
      headers: await authHeaders(global.modules),
      payload: { status: "IN_PROGRESS" },
    });
    expect(globalResponse.statusCode).toBe(200);
    await global.app.close();
  });

  it("não permite transição com kanban.manage sem tasks.update", async () => {
    const { app, modules } = await build();
    await seedActor(modules, true, "SEM_PERMISSAO");
    const membership = await modules.repositories.memberships.findByUserAndCompany(
      USER_ID,
      COMPANY_ID,
    );
    if (!membership) throw new Error("Membership não criada");
    membership.changePermissions(["kanban.manage"]);
    await modules.repositories.memberships.update(membership);
    await seedTask(modules, null);

    const response = await app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}/status`,
      headers: await authHeaders(modules),
      payload: { status: "IN_PROGRESS" },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("aplica autorização de criação por assignee", async () => {
    const own = await build();
    await seedActor(own.modules, true, "DESENVOLVEDOR");
    await seedMember(own.modules, OTHER_USER_ID);
    const ownHeaders = await authHeaders(own.modules);

    await expect(
      own.app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks`,
        headers: ownHeaders,
        payload: { title: "Sem responsável" },
      }),
    ).resolves.toMatchObject({ statusCode: 201 });
    await expect(
      own.app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks`,
        headers: ownHeaders,
        payload: { title: "Própria", assigneeId: USER_ID },
      }),
    ).resolves.toMatchObject({ statusCode: 201 });
    const denied = await own.app.inject({
      method: "POST",
      url: `/companies/${COMPANY_ID}/tasks`,
      headers: ownHeaders,
      payload: { title: "Terceiro", assigneeId: OTHER_USER_ID },
    });
    expect(denied.statusCode).toBe(403);
    await own.app.close();

    const global = await build();
    await seedActor(global.modules, true, "GESTOR");
    await seedMember(global.modules, OTHER_USER_ID);
    await expect(
      global.app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks`,
        headers: await authHeaders(global.modules),
        payload: { title: "Terceiro", assigneeId: OTHER_USER_ID },
      }),
    ).resolves.toMatchObject({ statusCode: 201 });
    await global.app.close();
  });

  it("aplica autorização de edição e self-claim", async () => {
    const own = await build();
    await seedActor(own.modules, true, "DESENVOLVEDOR");
    await seedTask(own.modules, USER_ID);
    const ownHeaders = await authHeaders(own.modules);
    await expect(
      own.app.inject({
        method: "PATCH",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}`,
        headers: ownHeaders,
        payload: { title: "Própria editada" },
      }),
    ).resolves.toMatchObject({ statusCode: 200 });
    const remove = await own.app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}`,
      headers: ownHeaders,
      payload: { assigneeId: null },
    });
    expect(remove.statusCode).toBe(403);
    await own.app.close();

    const claim = await build();
    await seedActor(claim.modules, true, "DESENVOLVEDOR");
    await seedTask(claim.modules, null);
    await expect(
      claim.app.inject({
        method: "PATCH",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}`,
        headers: await authHeaders(claim.modules),
        payload: { assigneeId: USER_ID },
      }),
    ).resolves.toMatchObject({ statusCode: 200 });
    await claim.app.close();

    const global = await build();
    await seedActor(global.modules, true, "GESTOR");
    await seedMember(global.modules, OTHER_USER_ID);
    await seedTask(global.modules, OTHER_USER_ID);
    await expect(
      global.app.inject({
        method: "PATCH",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}`,
        headers: await authHeaders(global.modules),
        payload: { title: "Global", assigneeId: null },
      }),
    ).resolves.toMatchObject({ statusCode: 200 });
    await global.app.close();
  });

  it("não permite criação ou edição com kanban.manage sem permissão operacional", async () => {
    const { app, modules } = await build();
    await seedActor(modules, true, "SEM_PERMISSAO");
    const membership = await modules.repositories.memberships.findByUserAndCompany(
      USER_ID,
      COMPANY_ID,
    );
    if (!membership) throw new Error("Membership não criada");
    membership.changePermissions(["kanban.manage"]);
    await modules.repositories.memberships.update(membership);
    await seedTask(modules, USER_ID);
    const headers = await authHeaders(modules);

    await expect(
      app.inject({
        method: "POST",
        url: `/companies/${COMPANY_ID}/tasks`,
        headers,
        payload: { title: "Negada" },
      }),
    ).resolves.toMatchObject({ statusCode: 403 });
    await expect(
      app.inject({
        method: "PATCH",
        url: `/companies/${COMPANY_ID}/tasks/${TASK_ID}`,
        headers,
        payload: { title: "Negada" },
      }),
    ).resolves.toMatchObject({ statusCode: 403 });
    await app.close();
  });
});
