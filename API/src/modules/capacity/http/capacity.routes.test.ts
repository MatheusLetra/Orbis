import type { FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { User } from "@/modules/users/domain/entities/user";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const MISSING_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const DEVELOPER_ID = "44444444-4444-4444-8444-444444444444";

async function build(): Promise<{ app: FastifyInstance; modules: TestModules }> {
  const modules = buildTestModules();
  const app = await buildApp({ logger: false, modules });
  return { app, modules };
}

async function authHeaders(modules: TestModules, userId = ACTOR_ID) {
  return { authorization: `Bearer ${await modules.tokenService.signAccessToken(userId)}` };
}

async function seedCapacity(
  modules: TestModules,
  options: { position?: string; activeMembership?: boolean; dailyHours?: number } = {},
) {
  await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
  const membership = Membership.create({
    companyId: COMPANY_ID,
    userId: ACTOR_ID,
    position: options.position ?? "GESTOR",
  });
  if (options.activeMembership === false) membership.deactivate();
  await modules.repositories.memberships.create(membership);
  await modules.repositories.users.create(
    User.create(
      { email: "developer@example.com", name: "Developer", passwordHash: "hash" },
      DEVELOPER_ID,
    ),
  );
  await modules.repositories.memberships.create(
    Membership.create({ companyId: COMPANY_ID, userId: DEVELOPER_ID, position: "DESENVOLVEDOR" }),
  );
  if (options.dailyHours !== undefined) {
    await modules.repositories.companyCapacitySettings.setDailyHoursPerDeveloper(
      COMPANY_ID,
      options.dailyHours,
    );
  }
}

describe("GET /companies/:companyId/capacity", () => {
  it("documenta params, query, resposta e erros no OpenAPI", async () => {
    const { app } = await build();
    await app.ready();
    const operation = app.swagger().paths["/companies/{companyId}/capacity"]?.get;

    expect(operation).toBeDefined();
    expect(operation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: "path", name: "companyId", required: true }),
        expect.objectContaining({
          in: "query",
          name: "startDate",
          required: true,
          schema: { format: "date-time", type: "string" },
        }),
        expect.objectContaining({
          in: "query",
          name: "estimatedHours",
          required: true,
          schema: { minimum: 0, type: "number" },
        }),
      ]),
    );
    expect(operation?.responses).toEqual(
      expect.objectContaining({
        200: expect.any(Object),
        400: expect.any(Object),
        401: expect.any(Object),
        403: expect.any(Object),
        404: expect.any(Object),
        422: expect.any(Object),
      }),
    );
    expect(operation?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: expect.objectContaining({
            required: expect.arrayContaining(["dailyCapacity", "plannedDeliveryDate"]),
          }),
        },
      },
    });
    await app.close();
  });

  it("retorna cálculo completo, normaliza datas para UTC e aceita zero/fração", async () => {
    const { app, modules } = await build();
    await seedCapacity(modules, { dailyHours: 8 });
    const headers = await authHeaders(modules);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity?startDate=2026-08-17T12:00:00-03:00&estimatedHours=10.5`,
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      companyId: COMPANY_ID,
      startDate: "2026-08-17T15:00:00.000Z",
      estimatedHours: 10.5,
      availableDevelopers: 1,
      dailyHoursPerDeveloper: 8,
      dailyCapacity: 8,
      requiredDays: 1.3125,
      plannedDeliveryDate: "2026-08-19T15:00:00.000Z",
    });

    const zero = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=0`,
      headers,
    });
    expect(zero.statusCode).toBe(200);
    expect(zero.json()).toMatchObject({ estimatedHours: 0, requiredDays: 0 });
    await app.close();
  });

  it.each([
    ["query ausente", ""],
    ["startDate inválida", "?startDate=invalid&estimatedHours=1"],
    ["estimatedHours negativo", "?startDate=2026-08-17T00:00:00.000Z&estimatedHours=-1"],
    ["estimatedHours NaN", "?startDate=2026-08-17T00:00:00.000Z&estimatedHours=NaN"],
    ["estimatedHours Infinity", "?startDate=2026-08-17T00:00:00.000Z&estimatedHours=Infinity"],
    ["query desconhecida", "?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1&extra=x"],
  ])("retorna 400 para %s", async (_label, query) => {
    const { app, modules } = await build();
    await seedCapacity(modules, { dailyHours: 8 });
    const response = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity${query}`,
      headers: await authHeaders(modules),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("retorna 400 para companyId inválido e 401 sem autenticação", async () => {
    const { app, modules } = await build();
    await seedCapacity(modules, { dailyHours: 8 });
    const invalid = await app.inject({
      method: "GET",
      url: "/companies/not-a-uuid/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1",
      headers: await authHeaders(modules),
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION_ERROR");

    const unauthenticated = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1`,
    });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json().error.code).toBe("UNAUTHORIZED");
    await app.close();
  });

  it("retorna 403 para falta de permissão, membership inativa e cross-tenant", async () => {
    const noPermission = await build();
    await seedCapacity(noPermission.modules, { position: "SEM_PERMISSAO", dailyHours: 8 });
    const denied = await noPermission.app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1`,
      headers: await authHeaders(noPermission.modules),
    });
    expect(denied.statusCode).toBe(403);

    const inactive = await build();
    await seedCapacity(inactive.modules, { activeMembership: false, dailyHours: 8 });
    const inactiveResponse = await inactive.app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1`,
      headers: await authHeaders(inactive.modules),
    });
    expect(inactiveResponse.statusCode).toBe(403);

    const crossTenant = await build();
    await seedCapacity(crossTenant.modules, { dailyHours: 8 });
    const crossTenantResponse = await crossTenant.app.inject({
      method: "GET",
      url: `/companies/${OTHER_COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1`,
      headers: await authHeaders(crossTenant.modules),
    });
    expect(crossTenantResponse.statusCode).toBe(403);
    await noPermission.app.close();
    await inactive.app.close();
    await crossTenant.app.close();
  });

  it("retorna 404 para empresa inexistente ou inativa", async () => {
    const { app, modules } = await build();
    await seedCapacity(modules, { dailyHours: 8 });
    await modules.repositories.memberships.create(
      Membership.create({ companyId: MISSING_COMPANY_ID, userId: ACTOR_ID, position: "GESTOR" }),
    );
    const missing = await app.inject({
      method: "GET",
      url: `/companies/${MISSING_COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1`,
      headers: await authHeaders(modules),
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("NOT_FOUND");

    const company = await modules.repositories.companies.findById(COMPANY_ID);
    company?.deactivate();
    if (company) await modules.repositories.companies.update(company);
    const inactive = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1`,
      headers: await authHeaders(modules),
    });
    expect(inactive.statusCode).toBe(404);
    await app.close();
  });

  it("retorna os erros de configuração e capacidade zero do use case", async () => {
    const missing = await build();
    await seedCapacity(missing.modules);
    const configuration = await missing.app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1`,
      headers: await authHeaders(missing.modules),
    });
    expect(configuration.statusCode).toBe(422);
    expect(configuration.json().error.code).toBe("CAPACITY_CONFIGURATION_MISSING");

    const zero = await build();
    await seedCapacity(zero.modules, { dailyHours: 8 });
    const developerMembership = await zero.modules.repositories.memberships.findByUserAndCompany(
      DEVELOPER_ID,
      COMPANY_ID,
    );
    developerMembership?.deactivate();
    if (developerMembership)
      await zero.modules.repositories.memberships.update(developerMembership);
    const capacity = await zero.app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1`,
      headers: await authHeaders(zero.modules),
    });
    expect(capacity.statusCode).toBe(422);
    expect(capacity.json().error.code).toBe("CAPACITY_ZERO");
    await missing.app.close();
    await zero.app.close();
  });

  it("delega o cálculo ao use case sem calcular na rota", async () => {
    const { app, modules } = await build();
    await seedCapacity(modules, { dailyHours: 8 });
    const execute = vi.spyOn(modules.calculateCapacity, "execute");
    const response = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity?startDate=2026-08-17T00:00:00.000Z&estimatedHours=1.5`,
      headers: await authHeaders(modules),
    });
    expect(response.statusCode).toBe(200);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        startDate: new Date("2026-08-17T00:00:00.000Z"),
        estimatedHours: 1.5,
      }),
    );
    await app.close();
  });
});

describe("/companies/:companyId/capacity-settings", () => {
  it("obtém e atualiza usando os use cases existentes", async () => {
    const { app, modules } = await build();
    await seedCapacity(modules);
    const headers = await authHeaders(modules);

    const initial = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/capacity-settings`,
      headers,
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toEqual({ companyId: COMPANY_ID, dailyHoursPerDeveloper: null });

    const updated = await app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY_ID}/capacity-settings`,
      headers,
      payload: { dailyHoursPerDeveloper: 7.5 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toEqual({ companyId: COMPANY_ID, dailyHoursPerDeveloper: 7.5 });
    await app.close();
  });
});
