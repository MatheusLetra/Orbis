import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { System } from "@/modules/systems/domain/entities/system";
import { SystemVersion } from "@/modules/versions/domain/entities/system-version";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const USER_ID = "11111111-1111-4111-8111-111111111111";

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

async function seedSystemWithVersion(modules: TestModules, companyId: string) {
  const system = System.create({ companyId, name: "ERP" });
  await modules.repositories.systems.create(system);
  const version = SystemVersion.create({ companyId, systemId: system.id, version: "1.0.0" });
  await modules.repositories.systemVersions.create(version);
  return { system, version };
}

describe("POST /companies/:companyId/systems/:systemId/versions", () => {
  it("cria uma versão quando o ator possui versions.manage", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const { system } = await seedSystemWithVersion(modules, company.id);

    const response = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/systems/${system.id}/versions`,
      headers: await authHeaders(modules, USER_ID),
      payload: { version: "2.0.0" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      systemId: system.id,
      version: "2.0.0",
      companyId: company.id,
    });
    await app.close();
  });

  it("retorna 403 sem permissão versions.manage", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "SUPORTE" }),
    );
    const { system } = await seedSystemWithVersion(modules, company.id);

    const response = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/systems/${system.id}/versions`,
      headers: await authHeaders(modules, USER_ID),
      payload: { version: "2.0.0" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });
});

describe("GET /companies/:companyId/systems/:systemId/versions", () => {
  it("lista as versões do sistema", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const { system, version } = await seedSystemWithVersion(modules, company.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/systems/${system.id}/versions`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].id).toBe(version.id);
    await app.close();
  });
});

describe("GET /companies/:companyId/versions/:versionId", () => {
  it("obtém uma versão pelo id", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const { version } = await seedSystemWithVersion(modules, company.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/versions/${version.id}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(version.id);
    await app.close();
  });

  it("retorna 404 para versão de outra empresa", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    const otherCompany = await modules.repositories.companies.create(
      Company.create({ name: "Outra" }),
    );
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const { version: foreignVersion } = await seedSystemWithVersion(modules, otherCompany.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/versions/${foreignVersion.id}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });
});

describe("PATCH /companies/:companyId/versions/:versionId", () => {
  it("atualiza uma versão", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const { version } = await seedSystemWithVersion(modules, company.id);

    const response = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}/versions/${version.id}`,
      headers: await authHeaders(modules, USER_ID),
      payload: { version: "1.0.1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().version).toBe("1.0.1");
    await app.close();
  });
});

describe("DELETE /companies/:companyId/versions/:versionId", () => {
  it("remove uma versão", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const { version } = await seedSystemWithVersion(modules, company.id);

    const response = await app.inject({
      method: "DELETE",
      url: `/companies/${company.id}/versions/${version.id}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(version.id);
    await app.close();
  });
});
