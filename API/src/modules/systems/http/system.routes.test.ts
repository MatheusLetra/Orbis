import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { System } from "@/modules/systems/domain/entities/system";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

async function build(): Promise<{ app: FastifyInstance; modules: TestModules }> {
  const modules = buildTestModules();
  const app = await buildApp({ logger: false, modules });
  return { app, modules };
}

async function authHeaders(
  modules: TestModules,
  userId: string,
): Promise<{ authorization: string }> {
  const token = await modules.tokenService.signAccessToken(userId);
  return { authorization: `Bearer ${token}` };
}

async function seedCompany(modules: TestModules, name = "Orbis") {
  const company = await modules.repositories.companies.create(Company.create({ name }));
  return company;
}

async function seedMembership(
  modules: TestModules,
  companyId: string,
  userId = USER_ID,
  position = "GESTOR",
): Promise<void> {
  await modules.repositories.memberships.create(Membership.create({ companyId, userId, position }));
}

async function seedSystem(modules: TestModules, companyId: string) {
  const system = System.create({ companyId, name: "ERP" });
  await modules.repositories.systems.create(system);
  return system;
}

describe("POST /companies/:companyId/systems", () => {
  it("cria um sistema quando o ator possui systems.manage", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    await seedMembership(modules, company.id);

    const response = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/systems`,
      headers: await authHeaders(modules, USER_ID),
      payload: { name: "ERP" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: "ERP",
      companyId: company.id,
      isActive: true,
    });
    await app.close();
  });

  it("retorna 403 sem permissão systems.manage", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    await seedMembership(modules, company.id, USER_ID, "SUPORTE");

    const response = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/systems`,
      headers: await authHeaders(modules, USER_ID),
      payload: { name: "ERP" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });
});

describe("GET /companies/:companyId/systems", () => {
  it("lista apenas os sistemas da empresa do ator", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const otherCompany = await seedCompany(modules, "Outra");
    await seedMembership(modules, company.id);
    await seedSystem(modules, company.id);
    await seedSystem(modules, otherCompany.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/systems`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].name).toBe("ERP");
    await app.close();
  });
});

describe("GET /companies/:companyId/systems/:systemId", () => {
  it("obtém um sistema", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    await seedMembership(modules, company.id);
    const system = await seedSystem(modules, company.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/systems/${system.id}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(system.id);
    await app.close();
  });

  it("retorna 404 para sistema de outra empresa", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const otherCompany = await seedCompany(modules, "Outra");
    await seedMembership(modules, company.id);
    const foreignSystem = await seedSystem(modules, otherCompany.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/systems/${foreignSystem.id}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });

  it("retorna 403 sem membership na empresa", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const system = await seedSystem(modules, company.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/systems/${system.id}`,
      headers: await authHeaders(modules, OTHER_USER_ID),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });
});

describe("PATCH /companies/:companyId/systems/:systemId", () => {
  it("atualiza um sistema", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    await seedMembership(modules, company.id);
    const system = await seedSystem(modules, company.id);

    const response = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}/systems/${system.id}`,
      headers: await authHeaders(modules, USER_ID),
      payload: { name: "ERP v2" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe("ERP v2");
    await app.close();
  });
});

describe("DELETE /companies/:companyId/systems/:systemId", () => {
  it("remove um sistema", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    await seedMembership(modules, company.id);
    const system = await seedSystem(modules, company.id);

    const response = await app.inject({
      method: "DELETE",
      url: `/companies/${company.id}/systems/${system.id}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(system.id);
    await app.close();
  });
});
