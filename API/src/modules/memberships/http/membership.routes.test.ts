import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { User } from "@/modules/users/domain/entities/user";
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

async function seedCompany(modules: TestModules) {
  return modules.repositories.companies.create(Company.create({ name: "Orbis" }));
}

async function seedUser(modules: TestModules) {
  return modules.repositories.users.create(
    User.create({ email: "ana@orbis.io", name: "Ana", passwordHash: "hash" }),
  );
}

async function seedActorMembership(modules: TestModules, companyId: string, position = "GESTOR") {
  return modules.repositories.memberships.create(
    Membership.create({ companyId, userId: USER_ID, position }),
  );
}

async function seedMembership(
  modules: TestModules,
  companyId: string,
  userId: string,
  position = "SUPORTE",
): Promise<void> {
  await modules.repositories.memberships.create(Membership.create({ companyId, userId, position }));
}

describe("POST /memberships", () => {
  it("vincula o usuário à empresa quando o ator possui users.manage", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const user = await seedUser(modules);
    await seedActorMembership(modules, company.id);

    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: await authHeaders(modules, USER_ID),
      payload: { companyId: company.id, userId: user.id, position: "SUPORTE" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      companyId: company.id,
      userId: user.id,
      position: "SUPORTE",
      isActive: true,
    });
    await app.close();
  });

  it("retorna 403 quando o ator não possui acesso à empresa", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const user = await seedUser(modules);

    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: await authHeaders(modules, USER_ID),
      payload: { companyId: company.id, userId: user.id, position: "SUPORTE" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });

  it("retorna 403 quando o ator não possui users.manage", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const user = await seedUser(modules);
    await seedActorMembership(modules, company.id, "TESTADOR");

    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: await authHeaders(modules, USER_ID),
      payload: { companyId: company.id, userId: user.id, position: "SUPORTE" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });

  it("retorna 404 quando a empresa não existe (ator com acesso)", async () => {
    const { app, modules } = await build();
    const user = await seedUser(modules);
    const missingCompanyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await seedActorMembership(modules, missingCompanyId);

    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: await authHeaders(modules, USER_ID),
      payload: {
        companyId: missingCompanyId,
        userId: user.id,
        position: "SUPORTE",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });

  it("retorna 404 quando o usuário não existe", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    await seedActorMembership(modules, company.id);

    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: await authHeaders(modules, USER_ID),
      payload: {
        companyId: company.id,
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        position: "SUPORTE",
      },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("retorna 409 quando a membership já existe", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const user = await seedUser(modules);
    await seedActorMembership(modules, company.id);
    const payload = { companyId: company.id, userId: user.id, position: "SUPORTE" };

    await app.inject({
      method: "POST",
      url: "/memberships",
      headers: await authHeaders(modules, USER_ID),
      payload,
    });
    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: await authHeaders(modules, USER_ID),
      payload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("CONFLICT");
    await app.close();
  });

  it("retorna 400 para corpo inválido", async () => {
    const { app, modules } = await build();
    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: await authHeaders(modules, USER_ID),
      payload: { companyId: "nao-e-uuid", userId: "nao-e-uuid", position: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});

describe("GET /memberships", () => {
  it("lista as memberships do usuário", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const user = await seedUser(modules);
    await modules.repositories.memberships.create(
      Membership.create({ companyId: company.id, userId: user.id, position: "GESTOR" }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/memberships",
      headers: await authHeaders(modules, user.id),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({ companyId: company.id, position: "GESTOR" });
    await app.close();
  });

  it("retorna 401 sem o header de usuário", async () => {
    const { app } = await build();
    const response = await app.inject({ method: "GET", url: "/memberships" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /companies/:companyId/members", () => {
  it("documenta o lookup mínimo no OpenAPI", async () => {
    const { app } = await build();
    await app.ready();
    const operation = app.swagger().paths["/companies/{companyId}/members"]?.get;
    expect(operation?.responses).toHaveProperty("200");
    expect(operation?.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "search", in: "query" })]),
    );
    await app.close();
  });

  it("lista somente membros ativos com identidade mínima e pesquisa", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    await seedUser(modules);
    const active = await modules.repositories.users.create(
      User.create({ email: "bruno@orbis.io", name: "Bruno Lima", passwordHash: "hash" }),
    );
    const inactive = await modules.repositories.users.create(
      User.create({ email: "carla@orbis.io", name: "Carla Souza", passwordHash: "hash" }),
    );
    await seedActorMembership(modules, company.id);
    await seedMembership(modules, company.id, active.id, "SUPORTE");
    await modules.repositories.memberships
      .create(
        Membership.create({ companyId: company.id, userId: inactive.id, position: "SUPORTE" }),
      )
      .then((membership) => {
        membership.deactivate();
        return modules.repositories.memberships.update(membership);
      });

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/members?search=  bruno `,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ userId: active.id, name: "Bruno Lima" }]);
    expect(response.json()[0]).not.toHaveProperty("permissions");
    expect(response.json()[0]).not.toHaveProperty("passwordHash");
    await app.close();
  });

  it.each([
    ["ausente", ""],
    ["vazia", "?search=   "],
  ])("aceita pesquisa opcional %s", async (_label, query) => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const user = await seedUser(modules);
    await seedActorMembership(modules, company.id);
    await seedMembership(modules, company.id, user.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/members${query}`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toContainEqual({ userId: user.id, name: "Ana" });
    await app.close();
  });

  it("rejeita parâmetro de query desconhecido", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    await seedActorMembership(modules, company.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/members?extra=x`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("isola o tenant e exige users.read", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const otherCompany = await modules.repositories.companies.create(
      Company.create({ name: "Outra" }),
    );
    await seedUser(modules);
    const foreign = await modules.repositories.users.create(
      User.create({ email: "foreign@orbis.io", name: "Foreign", passwordHash: "hash" }),
    );
    await seedActorMembership(modules, company.id, "TESTADOR");
    await seedMembership(modules, otherCompany.id, foreign.id, "GESTOR");

    const forbidden = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/members`,
      headers: await authHeaders(modules, USER_ID),
    });
    expect(forbidden.statusCode).toBe(403);

    const crossTenant = await app.inject({
      method: "GET",
      url: `/companies/${otherCompany.id}/members`,
      headers: await authHeaders(modules, USER_ID),
    });
    expect(crossTenant.statusCode).toBe(403);
    await app.close();
  });
});

describe("membership administration", () => {
  it("lista membership e usuário do tenant com users.read", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const otherCompany = await modules.repositories.companies.create(Company.create({ name: "B" }));
    const user = await seedUser(modules);
    const foreign = await modules.repositories.users.create(
      User.create({ email: "foreign@example.com", name: "Foreign", passwordHash: "hash" }),
    );
    await seedActorMembership(modules, company.id);
    await seedMembership(modules, company.id, user.id);
    await seedMembership(modules, otherCompany.id, foreign.id);

    const response = await app.inject({
      method: "GET",
      url: `/companies/${company.id}/memberships`,
      headers: await authHeaders(modules, USER_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: user.id,
          name: "Ana",
          email: "ana@orbis.io",
          position: "SUPORTE",
          permissions: [],
          userIsActive: true,
        }),
      ]),
    );
    expect(response.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: foreign.id })]),
    );
    await app.close();
  });

  it("cria usuário e membership e rejeita MASTER", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    await seedActorMembership(modules, company.id);
    const headers = await authHeaders(modules, USER_ID);

    const response = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/members`,
      headers,
      payload: {
        email: "new@example.com",
        name: "New User",
        password: "password123",
        position: "DESENVOLVEDOR",
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      email: "new@example.com",
      name: "New User",
      position: "DESENVOLVEDOR",
    });
    const createdUser = await modules.repositories.users.findByEmail("new@example.com");
    expect(createdUser?.passwordHash).toBe("scrypt:password123");
    expect(
      await modules.repositories.memberships.findByUserAndCompany(
        createdUser?.id ?? "",
        company.id,
      ),
    ).not.toBeNull();

    const master = await app.inject({
      method: "POST",
      url: `/companies/${company.id}/members`,
      headers,
      payload: {
        email: "master@example.com",
        name: "Master",
        password: "password123",
        position: "MASTER",
      },
    });
    expect(master.statusCode).toBe(400);
    await app.close();
  });

  it("altera permissões estritamente e isola membership de outro tenant", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const otherCompany = await modules.repositories.companies.create(Company.create({ name: "B" }));
    const user = await seedUser(modules);
    await seedActorMembership(modules, company.id);
    await seedMembership(modules, otherCompany.id, user.id);
    const foreign = await modules.repositories.memberships.findByUserAndCompany(
      user.id,
      otherCompany.id,
    );
    const headers = await authHeaders(modules, USER_ID);

    const hidden = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}/memberships/${foreign?.id}/permissions`,
      headers,
      payload: { permissions: ["tasks.read"] },
    });
    expect(hidden.statusCode).toBe(404);

    const actorMembership = await modules.repositories.memberships.findByUserAndCompany(
      USER_ID,
      company.id,
    );
    const valid = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}/memberships/${actorMembership?.id}/permissions`,
      headers,
      payload: { permissions: ["tasks.read", "permissions.manage"] },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().permissions).toEqual(["tasks.read", "permissions.manage"]);

    const invalid = await app.inject({
      method: "PATCH",
      url: `/companies/${company.id}/memberships/${actorMembership?.id}/permissions`,
      headers,
      payload: { permissions: ["invented.permission"] },
    });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });
});
