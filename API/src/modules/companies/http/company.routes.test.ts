import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";

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

describe("POST /companies", () => {
  it("cria a empresa e a membership GESTOR do dono", async () => {
    const { app, modules } = await build();
    const response = await app.inject({
      method: "POST",
      url: "/companies",
      headers: await authHeaders(modules, OWNER_ID),
      payload: { name: "Orbis Corp" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: "Orbis Corp",
      timezone: "America/Sao_Paulo",
      isActive: true,
    });

    const companyId = response.json().id;
    const membership = await modules.repositories.memberships.findByUserAndCompany(
      OWNER_ID,
      companyId,
    );
    expect(membership?.position).toBe("GESTOR");
    await app.close();
  });

  it("retorna 401 sem o header de usuário", async () => {
    const { app } = await build();
    const response = await app.inject({
      method: "POST",
      url: "/companies",
      payload: { name: "Orbis" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
    await app.close();
  });

  it("retorna 400 para corpo inválido", async () => {
    const { app, modules } = await build();
    const response = await app.inject({
      method: "POST",
      url: "/companies",
      headers: await authHeaders(modules, OWNER_ID),
      payload: { name: "  " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});

describe("GET /companies", () => {
  it("lista apenas as empresas do usuário", async () => {
    const { app, modules } = await build();
    const companyA = await modules.repositories.companies.create(Company.create({ name: "A" }));
    const companyB = await modules.repositories.companies.create(Company.create({ name: "B" }));
    modules.repositories.companies.linkUser(OWNER_ID, companyA.id);
    modules.repositories.companies.linkUser(OWNER_ID, companyB.id);

    const response = await app.inject({
      method: "GET",
      url: "/companies",
      headers: await authHeaders(modules, OWNER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(
      response
        .json()
        .map((c: { name: string }) => c.name)
        .sort(),
    ).toEqual(["A", "B"]);
    await app.close();
  });

  it("retorna 401 sem o header de usuário", async () => {
    const { app } = await build();
    const response = await app.inject({ method: "GET", url: "/companies" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /companies/:companyId", () => {
  it("retorna a empresa com acesso", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: OWNER_ID, position: "GESTOR" }),
    );

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}`,
      headers: await authHeaders(modules, OWNER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe("Orbis");
    await app.close();
  });

  it("retorna 403 sem membership ativa", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}`,
      headers: await authHeaders(modules, OWNER_ID),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });

  it("retorna 403 quando o usuário não possui company.read", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: OWNER_ID, position: "ESTAGIARIO" }),
    );

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}`,
      headers: await authHeaders(modules, OWNER_ID),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });
});

describe("GET /companies/:companyId/capabilities", () => {
  it("retorna capabilities efetivas sem expor tokens", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: OWNER_ID, position: "GESTOR" }),
    );

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/capabilities`,
      headers: await authHeaders(modules, OWNER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      companyId: company.id,
      capabilities: {
        "tasks.create": true,
        "tasks.update": true,
        "kanban.manage": true,
        "hours.register": true,
        "capacity.read": true,
        "users.read": true,
        "requisitions.read": true,
      },
    });
    expect(response.json()).not.toHaveProperty("accessToken");
    expect(response.json()).not.toHaveProperty("refreshToken");
    await app.close();
  });

  it("reflete permissões diferentes ao trocar de empresa", async () => {
    const { app, modules } = await build();
    const companyA = await modules.repositories.companies.create(Company.create({ name: "A" }));
    const companyB = await modules.repositories.companies.create(Company.create({ name: "B" }));
    const membershipA = Membership.create({
      companyId: companyA.id,
      userId: OWNER_ID,
      position: "SEM_PERMISSAO",
    });
    membershipA.changePermissions(["tasks.create"]);
    const membershipB = Membership.create({
      companyId: companyB.id,
      userId: OWNER_ID,
      position: "SEM_PERMISSAO",
    });
    membershipB.changePermissions([
      "tasks.update",
      "hours.register",
      "capacity.read",
      "users.read",
      "requisitions.read",
    ]);
    await modules.repositories.memberships.create(membershipA);
    await modules.repositories.memberships.create(membershipB);
    const headers = await authHeaders(modules, OWNER_ID);

    const responseA = await app.inject({
      method: "GET",
      url: `/companies/${companyA.id}/capabilities`,
      headers,
    });
    const responseB = await app.inject({
      method: "GET",
      url: `/companies/${companyB.id}/capabilities`,
      headers,
    });

    expect(responseA.json().capabilities).toMatchObject({
      "tasks.create": true,
      "tasks.update": false,
      "kanban.manage": false,
      "hours.register": false,
    });
    expect(responseB.json().capabilities).toMatchObject({
      "tasks.create": false,
      "tasks.update": true,
      "kanban.manage": false,
      "hours.register": true,
      "capacity.read": true,
      "users.read": true,
      "requisitions.read": true,
    });
    await app.close();
  });

  it("retorna todas as capabilities falsas quando nenhuma está concedida", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: OWNER_ID, position: "SEM_PERMISSAO" }),
    );

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/capabilities`,
      headers: await authHeaders(modules, OWNER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(Object.values(response.json().capabilities)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    await app.close();
  });

  it("protege autenticação e isolamento entre tenants", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));

    const unauthenticated = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/capabilities`,
    });
    expect(unauthenticated.statusCode).toBe(401);

    const inaccessible = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/capabilities`,
      headers: await authHeaders(modules, OWNER_ID),
    });
    expect(inaccessible.statusCode).toBe(403);
    expect(inaccessible.json().error.code).toBe("FORBIDDEN");

    const missing = await app.inject({
      method: "GET",
      url: "/companies/99999999-9999-4999-8999-999999999999/capabilities",
      headers: await authHeaders(modules, OWNER_ID),
    });
    expect(missing.statusCode).toBe(403);
    expect(missing.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });

  it("nega capabilities para membership inativa", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    const membership = Membership.create({
      companyId: company.id,
      userId: OWNER_ID,
      position: "GESTOR",
    });
    membership.deactivate();
    await modules.repositories.memberships.create(membership);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/capabilities`,
      headers: await authHeaders(modules, OWNER_ID),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });
});

describe("PATCH /companies/:companyId", () => {
  it("atualiza a empresa com acesso", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: OWNER_ID, position: "GESTOR" }),
    );

    const response = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}`,
      headers: await authHeaders(modules, OWNER_ID),
      payload: { name: "Orbis SA", timezone: "America/New_York" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: "Orbis SA", timezone: "America/New_York" });
    await app.close();
  });

  it("retorna 400 para corpo vazio", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: OWNER_ID, position: "GESTOR" }),
    );

    const response = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}`,
      headers: await authHeaders(modules, OWNER_ID),
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("retorna 403 quando o usuário não possui company.update", async () => {
    const { app, modules } = await build();
    const company = await modules.repositories.companies.create(Company.create({ name: "Orbis" }));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: OWNER_ID, position: "ESTAGIARIO" }),
    );

    const response = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}`,
      headers: await authHeaders(modules, OWNER_ID),
      payload: { name: "Orbis SA" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });
});
