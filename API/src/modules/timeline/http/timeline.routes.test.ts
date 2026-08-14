import { describe, expect, it } from "vitest";

import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import { Task } from "@/modules/tasks/domain/entities/task";
import { User } from "@/modules/users/domain/entities/user";
import { buildTestModules } from "@/test/modules-test-helper";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

async function setup() {
  const modules = buildTestModules();
  await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
  await modules.repositories.users.create(
    User.create({ email: "gestor@example.com", name: "Gestor", passwordHash: "hash" }, USER_ID),
  );
  await modules.repositories.memberships.create(
    Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "GESTOR" }),
  );
  const app = await buildApp({ logger: false, modules });
  const authorization = `Bearer ${await modules.tokenService.signAccessToken(USER_ID)}`;
  return { app, modules, authorization };
}

describe("Timeline HTTP", () => {
  it("expõe e retorna a timeline mensal de requisições", async () => {
    const { app, modules, authorization } = await setup();
    await modules.repositories.requisitions.create(
      Requisition.restore({
        id: "33333333-3333-4333-8333-333333333333",
        companyId: COMPANY_ID,
        number: 10,
        title: "Mensal",
        description: null,
        priority: "HIGH",
        status: "OPEN",
        requesterId: USER_ID,
        responsibleId: USER_ID,
        systemId: null,
        systemVersionId: null,
        estimatedHours: 5,
        startDate: new Date("2026-08-10T00:00:00Z"),
        plannedDeliveryDate: new Date("2026-08-12T00:00:00Z"),
        deliveredAt: null,
        createdAt: new Date("2026-08-01T00:00:00Z"),
        updatedAt: new Date("2026-08-01T00:00:00Z"),
      }),
    );
    await app.ready();
    const operation = app.swagger().paths["/companies/{companyId}/timeline/monthly"]?.get;
    expect(Object.keys(operation?.responses ?? {})).toEqual(["200", "400", "401", "403", "404"]);
    expect(
      operation?.parameters
        ?.filter((parameter) => parameter.in === "query")
        .map((parameter) => parameter.name),
    ).toEqual(["period", "priority", "assigneeId", "status"]);
    const response = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/timeline/monthly?period=2026-08&priority=HIGH`,
      headers: { authorization },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      period: "2026-08",
      indicators: {
        totalRequisitions: 1,
        estimatedHours: 5,
        deliveredOnTime: 0,
        overdue: 0,
      },
      items: [{ requisitionId: "33333333-3333-4333-8333-333333333333", assigneeId: USER_ID }],
    });
    await app.close();
  });

  it("documenta o contrato semanal completo no OpenAPI", async () => {
    const { app } = await setup();
    await app.ready();
    const operation = app.swagger().paths["/companies/{companyId}/timeline/weekly"]?.get;

    expect(Object.keys(operation?.responses ?? {})).toEqual(["200", "400", "401", "403", "404"]);
    expect(
      operation?.parameters
        ?.filter((parameter) => parameter.in === "query")
        .map((parameter) => parameter.name),
    ).toEqual(["weekStart", "assigneeId", "status", "priority"]);
    expect(
      operation?.parameters?.find((parameter) => parameter.name === "weekStart")?.required,
    ).toBe(true);
    const schema = operation?.responses?.["200"]?.content?.["application/json"]?.schema;
    expect(schema).toMatchObject({
      additionalProperties: false,
      required: [
        "companyId",
        "weekStart",
        "weekEnd",
        "days",
        "undatedTasks",
        "overdueTasks",
        "weekendTasks",
        "assignees",
      ],
      properties: {
        days: { minItems: 5, maxItems: 5 },
        undatedTasks: expect.any(Object),
        overdueTasks: expect.any(Object),
        weekendTasks: expect.any(Object),
        assignees: expect.any(Object),
      },
    });
    expect(schema?.properties).not.toHaveProperty("tasks");
    const taskSchema = schema?.properties?.days?.items?.properties?.tasks?.items;
    expect(taskSchema).toMatchObject({
      additionalProperties: false,
      required: [
        "id",
        "companyId",
        "requisitionId",
        "title",
        "description",
        "priority",
        "status",
        "assigneeId",
        "startDate",
        "plannedEndDate",
        "completedAt",
        "isOverdue",
        "isPaused",
      ],
    });
    expect(taskSchema?.properties).not.toHaveProperty("assignee");
    await app.close();
  });

  it("rejeita query mensal desconhecida sem alterar a weekly", async () => {
    const { app, authorization } = await setup();
    const response = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/timeline/monthly?period=2026-08&unknown=1`,
      headers: { authorization },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("retorna datas calendário, filtros e faceta sem relações pesadas", async () => {
    const { app, modules, authorization } = await setup();
    await modules.repositories.tasks.create(
      Task.restore({
        id: "33333333-3333-4333-8333-333333333333",
        companyId: COMPANY_ID,
        requisitionId: null,
        title: "Tarefa semanal",
        description: "não expor",
        priority: "HIGH",
        status: "PAUSED",
        assigneeId: USER_ID,
        startDate: new Date("2026-08-10T00:00:00Z"),
        plannedEndDate: new Date("2026-08-14T00:00:00Z"),
        completedAt: null,
        createdAt: new Date("2026-08-01T00:00:00Z"),
        updatedAt: new Date("2026-08-01T00:00:00Z"),
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/timeline/weekly?weekStart=2026-08-10&priority=HIGH`,
      headers: { authorization },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
      companyId: COMPANY_ID,
      days: [
        {
          date: "2026-08-10",
          isBusinessDay: true,
          tasks: [{ title: "Tarefa semanal" }],
        },
        {
          date: "2026-08-11",
          isBusinessDay: true,
          tasks: [{ title: "Tarefa semanal" }],
        },
        {
          date: "2026-08-12",
          isBusinessDay: true,
          tasks: [{ title: "Tarefa semanal" }],
        },
        {
          date: "2026-08-13",
          isBusinessDay: true,
          tasks: [{ title: "Tarefa semanal" }],
        },
        {
          date: "2026-08-14",
          isBusinessDay: true,
          tasks: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              companyId: COMPANY_ID,
              requisitionId: null,
              description: "não expor",
              assigneeId: USER_ID,
              title: "Tarefa semanal",
              startDate: "2026-08-10",
              plannedEndDate: "2026-08-14",
              completedAt: null,
              isPaused: true,
            },
          ],
        },
      ],
      undatedTasks: [],
      overdueTasks: [],
      weekendTasks: [],
      assignees: [{ id: USER_ID, name: "Gestor" }],
    });
    expect(response.json()).not.toHaveProperty("tasks");
    expect(response.json().days[0].tasks[0]).not.toHaveProperty("assignee");
    await app.close();
  });

  it("rejeita weekStart ausente, não segunda e query desconhecida", async () => {
    const { app, authorization } = await setup();
    for (const query of ["", "?weekStart=2026-08-11", "?weekStart=2026-08-10&extra=1"]) {
      const response = await app.inject({
        method: "GET",
        url: `/companies/${COMPANY_ID}/timeline/weekly${query}`,
        headers: { authorization },
      });
      expect(response.statusCode).toBe(400);
    }
    await app.close();
  });
});
