import { describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { buildTestModules } from "@/test/modules-test-helper";

const companyId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

async function build() {
  const modules = buildTestModules();
  await modules.repositories.companies.create(Company.create({ name: "A" }, companyId));
  const membership = Membership.create({ companyId, userId, position: "GESTOR" });
  membership.changePermissions(["audit.read"]);
  await modules.repositories.memberships.create(membership);
  await modules.auditRecorder.record({
    companyId,
    actorUserId: userId,
    action: "TASK_STATUS_CHANGED",
    entityType: "TASK",
    entityId: "33333333-3333-4333-8333-333333333333",
    metadata: { fromStatus: "TODO", toStatus: "DONE" },
  });
  const app = await buildApp({ logger: false, modules });
  const authorization = {
    authorization: `Bearer ${await modules.tokenService.signAccessToken(userId)}`,
  };
  return { app, authorization };
}

describe("Auditoria HTTP/OpenAPI", () => {
  it("documenta e lista registros com filtros", async () => {
    const { app, authorization } = await build();
    await app.ready();
    expect(app.swagger().paths["/companies/{companyId}/audit"]).toBeDefined();
    const response = await app.inject({
      method: "GET",
      url: `/companies/${companyId}/audit?action=TASK_STATUS_CHANGED&limit=50`,
      headers: authorization,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      companyId,
      items: [{ action: "TASK_STATUS_CHANGED" }],
    });
    await app.close();
  });

  it("rejeita query desconhecida, cursor inválido e ausência de autenticação", async () => {
    const { app, authorization } = await build();
    const unknown = await app.inject({
      method: "GET",
      url: `/companies/${companyId}/audit?unexpected=true`,
      headers: authorization,
    });
    const cursor = await app.inject({
      method: "GET",
      url: `/companies/${companyId}/audit?cursor=invalid`,
      headers: authorization,
    });
    const unauthenticated = await app.inject({
      method: "GET",
      url: `/companies/${companyId}/audit`,
    });
    expect(unknown.statusCode).toBe(400);
    expect(cursor.statusCode).toBe(400);
    expect(unauthenticated.statusCode).toBe(401);
    await app.close();
  });
});
