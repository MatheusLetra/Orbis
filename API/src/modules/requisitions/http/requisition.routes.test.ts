import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { System } from "@/modules/systems/domain/entities/system";
import { SystemVersion } from "@/modules/versions/domain/entities/system-version";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const RESPONSIBLE_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_USER_ID = "55555555-5555-4555-8555-555555555555";

async function build(): Promise<{ app: FastifyInstance; modules: TestModules }> {
  const modules = buildTestModules();
  const app = await buildApp({ logger: false, modules });
  return { app, modules };
}

async function authHeaders(modules: TestModules, userId = USER_ID) {
  return { authorization: `Bearer ${await modules.tokenService.signAccessToken(userId)}` };
}

async function seedCompany(modules: TestModules, id: string, name: string): Promise<void> {
  await modules.repositories.companies.create(Company.create({ name }, id));
}

async function seedMembership(
  modules: TestModules,
  companyId: string,
  userId: string,
  position = "GESTOR",
): Promise<void> {
  await modules.repositories.memberships.create(Membership.create({ companyId, userId, position }));
}

async function seedCatalog(modules: TestModules) {
  const system = await modules.repositories.systems.create(
    System.create({ companyId: COMPANY_ID, name: "ERP" }),
  );
  const version = await modules.repositories.systemVersions.create(
    SystemVersion.create({ companyId: COMPANY_ID, systemId: system.id, version: "1.0" }),
  );
  return { system, version };
}

async function createRequisition(
  app: FastifyInstance,
  modules: TestModules,
  companyId = COMPANY_ID,
  payload: Record<string, unknown> = { title: "Nova requisição" },
) {
  return app.inject({
    method: "POST",
    url: `/companies/${companyId}/requisitions`,
    headers: await authHeaders(modules),
    payload,
  });
}

describe("Requisition HTTP integration", () => {
  it("documenta as oito rotas e os schemas principais no OpenAPI", async () => {
    const { app } = await build();
    await app.ready();
    const paths = app.swagger().paths;

    expect(Object.keys(paths)).toEqual(
      expect.arrayContaining([
        "/companies/{companyId}/requisitions",
        "/companies/{companyId}/requisitions/{requisitionId}",
        "/companies/{companyId}/requisitions/{requisitionId}/assignees",
        "/companies/{companyId}/requisitions/{requisitionId}/assignees/{userId}",
      ]),
    );
    expect(paths["/companies/{companyId}/requisitions"]?.post?.responses).toHaveProperty("201");
    expect(paths["/companies/{companyId}/requisitions"]?.get?.responses).toHaveProperty("200");
    expect(
      paths["/companies/{companyId}/requisitions/{requisitionId}"]?.get?.responses,
    ).toHaveProperty("200");
    await app.close();
  });

  it("executa CRUD e preserva lista sem assignees e detalhe com assignees", async () => {
    const { app, modules } = await build();
    await seedCompany(modules, COMPANY_ID, "Orbis");
    await seedMembership(modules, COMPANY_ID, USER_ID);
    await seedMembership(modules, COMPANY_ID, RESPONSIBLE_ID);

    const created = await createRequisition(app, modules, COMPANY_ID, {
      title: "Nova",
      responsibleId: RESPONSIBLE_ID,
    });
    const id = created.json().id;
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ number: 1, requesterId: USER_ID });

    const listed = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/requisitions`,
      headers: await authHeaders(modules),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()[0]).not.toHaveProperty("assignees");

    const detail = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/requisitions/${id}`,
      headers: await authHeaders(modules),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().assignees).toEqual([]);

    const updated = await app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY_ID}/requisitions/${id}`,
      headers: await authHeaders(modules),
      payload: { title: "Atualizada", priority: "HIGH" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ title: "Atualizada", priority: "HIGH" });

    const deleted = await app.inject({
      method: "DELETE",
      url: `/companies/${COMPANY_ID}/requisitions/${id}`,
      headers: await authHeaders(modules),
    });
    expect(deleted.statusCode).toBe(200);
    await app.close();
  });

  it("aplica os filtros oficiais", async () => {
    const { app, modules } = await build();
    await seedCompany(modules, COMPANY_ID, "Orbis");
    await seedMembership(modules, COMPANY_ID, USER_ID);
    await seedMembership(modules, COMPANY_ID, RESPONSIBLE_ID);
    await createRequisition(app, modules, COMPANY_ID, { title: "Alta", priority: "HIGH" });
    await createRequisition(app, modules, COMPANY_ID, {
      title: "Responsável",
      responsibleId: RESPONSIBLE_ID,
    });

    const response = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/requisitions?priority=HIGH`,
      headers: await authHeaders(modules),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].title).toBe("Alta");

    const responsible = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/requisitions?responsibleId=${RESPONSIBLE_ID}`,
      headers: await authHeaders(modules),
    });
    expect(responsible.json()).toHaveLength(1);
    await app.close();
  });

  it("isola empresas e rejeita relações inválidas", async () => {
    const { app, modules } = await build();
    await seedCompany(modules, COMPANY_ID, "Orbis");
    await seedCompany(modules, OTHER_COMPANY_ID, "Outra");
    await seedMembership(modules, COMPANY_ID, USER_ID);
    const foreign = await createRequisition(app, modules, OTHER_COMPANY_ID);
    expect(foreign.statusCode).toBe(403);

    const invalidResponsible = await createRequisition(app, modules, COMPANY_ID, {
      title: "Inválida",
      responsibleId: OTHER_USER_ID,
    });
    expect(invalidResponsible.statusCode).toBe(404);

    const catalog = await seedCatalog(modules);
    const valid = await createRequisition(app, modules, COMPANY_ID, {
      title: "Relacionada",
      systemId: catalog.system.id,
      systemVersionId: catalog.version.id,
    });
    expect(valid.statusCode).toBe(201);

    const missingSystem = await createRequisition(app, modules, COMPANY_ID, {
      title: "Sem sistema",
      systemId: OTHER_COMPANY_ID,
    });
    expect(missingSystem.statusCode).toBe(404);

    const missingVersion = await createRequisition(app, modules, COMPANY_ID, {
      title: "Sem versão",
      systemVersionId: OTHER_COMPANY_ID,
    });
    expect(missingVersion.statusCode).toBe(404);
    await app.close();
  });

  it("gerencia assignees com idempotência", async () => {
    const { app, modules } = await build();
    await seedCompany(modules, COMPANY_ID, "Orbis");
    await seedMembership(modules, COMPANY_ID, USER_ID);
    await seedMembership(modules, COMPANY_ID, RESPONSIBLE_ID);
    const created = await createRequisition(app, modules, COMPANY_ID);
    const id = created.json().id;
    const url = `/companies/${COMPANY_ID}/requisitions/${id}/assignees`;
    const payload = { userId: RESPONSIBLE_ID };

    const first = await app.inject({
      method: "POST",
      url,
      headers: await authHeaders(modules),
      payload,
    });
    const duplicate = await app.inject({
      method: "POST",
      url,
      headers: await authHeaders(modules),
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(duplicate.json()).toEqual(first.json());

    const detail = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/requisitions/${id}`,
      headers: await authHeaders(modules),
    });
    expect(detail.json().assignees).toHaveLength(1);

    const removed = await app.inject({
      method: "DELETE",
      url: `${url}/${RESPONSIBLE_ID}`,
      headers: await authHeaders(modules),
    });
    const missing = await app.inject({
      method: "DELETE",
      url: `${url}/${RESPONSIBLE_ID}`,
      headers: await authHeaders(modules),
    });
    expect(removed.statusCode).toBe(200);
    expect(missing.statusCode).toBe(200);
    await app.close();
  });

  it("aplica permissões e validação HTTP", async () => {
    const { app, modules } = await build();
    await seedCompany(modules, COMPANY_ID, "Orbis");
    await seedMembership(modules, COMPANY_ID, USER_ID, "GESTOR");
    await seedMembership(modules, COMPANY_ID, OTHER_USER_ID, "SUPORTE");

    const created = await createRequisition(app, modules);
    expect(created.statusCode).toBe(201);
    const requisitionId = created.json().id;

    const read = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/requisitions`,
      headers: await authHeaders(modules, OTHER_USER_ID),
    });
    expect(read.statusCode).toBe(200);

    const forbiddenCreate = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY_ID}/requisitions`,
      headers: await authHeaders(modules, OTHER_USER_ID),
      payload: { title: "Sem permissão" },
    });
    expect(forbiddenCreate.statusCode).toBe(403);

    const forbiddenUpdate = await app.inject({
      method: "PATCH",
      url: `/companies/${COMPANY_ID}/requisitions/${requisitionId}`,
      headers: await authHeaders(modules, OTHER_USER_ID),
      payload: { title: "Sem permissão" },
    });
    expect(forbiddenUpdate.statusCode).toBe(403);

    const forbiddenDelete = await app.inject({
      method: "DELETE",
      url: `/companies/${COMPANY_ID}/requisitions/${requisitionId}`,
      headers: await authHeaders(modules, OTHER_USER_ID),
    });
    expect(forbiddenDelete.statusCode).toBe(403);

    const invalid = await app.inject({
      method: "POST",
      url: `/companies/${COMPANY_ID}/requisitions`,
      headers: await authHeaders(modules),
      payload: { title: "", status: "DONE" },
    });
    expect(invalid.statusCode).toBe(400);

    const unauthenticated = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY_ID}/requisitions`,
    });
    expect(unauthenticated.statusCode).toBe(401);
    await app.close();
  });
});
