import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { Release } from "@/modules/releases/domain/entities/release";
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

async function seedVersion(modules: TestModules, companyId: string) {
  const system = System.create({ companyId, name: "ERP" });
  await modules.repositories.systems.create(system);
  const version = SystemVersion.create({ companyId, systemId: system.id, version: "1.0.0" });
  await modules.repositories.systemVersions.create(version);
  return version;
}

async function seedDraftRelease(
  modules: TestModules,
  companyId: string,
  versionId: string,
  createdBy = USER_ID,
) {
  const release = Release.create({
    companyId,
    systemVersionId: versionId,
    versionLabel: "1.0.0",
    createdBy,
  });
  await modules.repositories.releases.create(release);
  return release;
}

describe("POST /companies/:companyId/releases", () => {
  it("cria uma release em rascunho", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const version = await seedVersion(modules, company.id);

    const response = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/releases`,
      headers: await authHeaders(modules, USER_ID),
      payload: { systemVersionId: version.id, versionLabel: "1.0.0" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      systemVersionId: version.id,
      versionLabel: "1.0.0",
      status: "DRAFT",
      channel: "STABLE",
      artifactName: null,
      artifactLocation: null,
    });
    await app.close();
  });

  it("retorna 404 quando a versão não pertence à empresa", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    const otherCompany = await modules.repositories.companies.create(
      Company.create({ name: "Outra" }),
    );
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const foreignVersion = await seedVersion(modules, otherCompany.id);

    const response = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/releases`,
      headers: await authHeaders(modules, USER_ID),
      payload: { systemVersionId: foreignVersion.id, versionLabel: "1.0.0" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });
});

describe("GET /companies/:companyId/releases", () => {
  it("lista apenas releases da empresa", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    const otherCompany = await modules.repositories.companies.create(
      Company.create({ name: "Outra" }),
    );
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const version = await seedVersion(modules, company.id);
    const otherVersion = await seedVersion(modules, otherCompany.id);
    await seedDraftRelease(modules, company.id, version.id);
    await seedDraftRelease(modules, otherCompany.id, otherVersion.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/releases`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].versionLabel).toBe("1.0.0");
    await app.close();
  });
});

describe("GET /companies/:companyId/releases/:releaseId", () => {
  it("obtém uma release pelo id", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const version = await seedVersion(modules, company.id);
    const release = await seedDraftRelease(modules, company.id, version.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/releases/${release.id}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(release.id);
    await app.close();
  });

  it("retorna 404 para release de outra empresa", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    const otherCompany = await modules.repositories.companies.create(
      Company.create({ name: "Outra" }),
    );
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const otherVersion = await seedVersion(modules, otherCompany.id);
    const foreignRelease = await seedDraftRelease(modules, otherCompany.id, otherVersion.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/releases/${foreignRelease.id}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });
});

describe("POST /companies/:companyId/releases/:releaseId/publish", () => {
  it("publica a release com localização manual", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const version = await seedVersion(modules, company.id);
    const release = await seedDraftRelease(modules, company.id, version.id);
    const response = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/releases/${release.id}/publish`,
      headers: await authHeaders(modules, USER_ID),
      payload: { artifactName: "app.exe", artifactLocation: "https://example.test/app.exe" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("PUBLISHED");
    expect(body.artifactName).toBe("app.exe");
    expect(body.artifactLocation).toBe("https://example.test/app.exe");
    expect(body.publishedAt).not.toBeNull();
    await app.close();
  });

  it("retorna 400 para localização vazia", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const version = await seedVersion(modules, company.id);
    const release = await seedDraftRelease(modules, company.id, version.id);

    const response = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/releases/${release.id}/publish`,
      headers: await authHeaders(modules, USER_ID),
      payload: { artifactName: "app.exe", artifactLocation: " " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("retorna 422 ao publicar release já publicada", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const version = await seedVersion(modules, company.id);
    const release = await seedDraftRelease(modules, company.id, version.id);
    const payload = { artifactName: "app.exe", artifactLocation: "https://example.test/app.exe" };

    const first = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/releases/${release.id}/publish`,
      headers: await authHeaders(modules, USER_ID),
      payload,
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/releases/${release.id}/publish`,
      headers: await authHeaders(modules, USER_ID),
      payload,
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("CONFLICT");
    await app.close();
  });
});

describe("PATCH /companies/:companyId/releases/:releaseId", () => {
  it("atualiza parcialmente metadados apenas enquanto DRAFT", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const version = await seedVersion(modules, company.id);
    const release = await seedDraftRelease(modules, company.id, version.id);
    const headers = await authHeaders(modules, USER_ID);

    const updated = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}/releases/${release.id}`,
      headers,
      payload: { channel: "BETA" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      versionLabel: "1.0.0",
      channel: "BETA",
      status: "DRAFT",
    });

    await modules.repositories.releases.publishIfDraft(release.id, {
      artifactName: "app.exe",
      artifactLocation: "https://example.test/app.exe",
    });
    const conflict = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}/releases/${release.id}`,
      headers,
      payload: { versionLabel: "2.0.0" },
    });
    expect(conflict.statusCode).toBe(409);
    await app.close();
  });
});

describe("DELETE /companies/:companyId/releases/:releaseId", () => {
  it("remove uma release", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: USER_ID, position: "GESTOR" }),
    );
    const version = await seedVersion(modules, company.id);
    const release = await seedDraftRelease(modules, company.id, version.id);

    const response = await app.inject({
      method: "DELETE",
      url: `/companies/${company.id}/releases/${release.id}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(release.id);
    await app.close();
  });
});
