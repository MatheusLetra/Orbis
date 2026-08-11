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

async function seedCompany(modules: TestModules) {
  return modules.repositories.companies.create(Company.create({ name: "Orbis" }));
}

async function seedUser(modules: TestModules) {
  return modules.repositories.users.create(
    User.create({ email: "ana@orbis.io", name: "Ana", passwordHash: "hash" }),
  );
}

describe("POST /memberships", () => {
  it("vincula o usuário à empresa", async () => {
    const { app, modules } = await build();
    const company = await seedCompany(modules);
    const user = await seedUser(modules);

    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: { "x-user-id": USER_ID },
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

  it("retorna 404 quando a empresa não existe", async () => {
    const { app, modules } = await build();
    const user = await seedUser(modules);

    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: { "x-user-id": USER_ID },
      payload: {
        companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: { "x-user-id": USER_ID },
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
    const payload = { companyId: company.id, userId: user.id, position: "SUPORTE" };

    await app.inject({
      method: "POST",
      url: "/memberships",
      headers: { "x-user-id": USER_ID },
      payload,
    });
    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: { "x-user-id": USER_ID },
      payload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("CONFLICT");
    await app.close();
  });

  it("retorna 400 para corpo inválido", async () => {
    const { app } = await build();
    const response = await app.inject({
      method: "POST",
      url: "/memberships",
      headers: { "x-user-id": USER_ID },
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
      headers: { "x-user-id": user.id },
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
