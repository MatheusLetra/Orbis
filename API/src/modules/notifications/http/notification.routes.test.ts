import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { Notification } from "@/modules/notifications/domain/entities/notification";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const THIRD_USER_ID = "22222222-2222-4222-8222-222222222222";

describe("notification HTTP/OpenAPI", () => {
  let app: FastifyInstance;
  let modules: TestModules;

  beforeEach(async () => {
    modules = buildTestModules();
    app = await buildApp({ logger: false, modules });
  });

  afterEach(async () => {
    await app.close();
  });

  async function company(name = "Orbis") {
    return modules.repositories.companies.create(Company.create({ name }));
  }

  async function membership(companyId: string, userId = USER_ID) {
    await modules.repositories.memberships.create(
      Membership.create({ companyId, userId, position: "SUPORTE" }),
    );
  }

  async function headers(userId = USER_ID) {
    const token = await modules.tokenService.signAccessToken(userId);
    return { authorization: `Bearer ${token}` };
  }

  function notification(companyId: string, userId: string, id: string, createdAt: string) {
    return Notification.restore({
      id,
      companyId,
      userId,
      eventId: null,
      type: "TASK_ASSIGNED",
      title: `Notificação ${id}`,
      body: null,
      readAt: null,
      data: { taskId: id },
      createdAt: new Date(createdAt),
    });
  }

  it.each([
    ["GET", "/companies/11111111-1111-4111-8111-111111111111/notifications"],
    [
      "PATCH",
      "/companies/11111111-1111-4111-8111-111111111111/notifications/22222222-2222-4222-8222-222222222222/read",
    ],
    ["GET", "/companies/11111111-1111-4111-8111-111111111111/notification-preferences"],
    ["PATCH", "/companies/11111111-1111-4111-8111-111111111111/notification-preferences"],
  ] as const)("%s %s retorna 401 sem autenticação", async (method, url) => {
    const response = await app.inject({
      method,
      url,
      ...(url.endsWith("notification-preferences") && method === "PATCH"
        ? { payload: { eventType: "TASK_ASSIGNED", inAppEnabled: true } }
        : {}),
    });
    expect(response.statusCode).toBe(401);
  });

  it("retorna 403 sem membership e ao tentar acessar outro tenant", async () => {
    const ownCompany = await company();
    const otherCompany = await company("Outra");
    await membership(ownCompany.id);
    const authorization = await headers();

    const withoutMembership = await app.inject({
      method: "GET",
      url: `/companies/${otherCompany.id}/notifications`,
      headers: authorization,
    });
    expect(withoutMembership.statusCode).toBe(403);

    const crossTenantPreference = await app.inject({
      method: "GET",
      url: `/companies/${otherCompany.id}/notification-preferences`,
      headers: authorization,
    });
    expect(crossTenantPreference.statusCode).toBe(403);
  });

  it.each(["limit=1.5", "limit=0", "limit=101", "unknown=true"])(
    "rejeita query estrita inválida: %s",
    async (query) => {
      const tenant = await company();
      await membership(tenant.id);
      const response = await app.inject({
        method: "GET",
        url: `/companies/${tenant.id}/notifications?${query}`,
        headers: await headers(),
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    },
  );

  it("lista somente notificações próprias com unreadCount global e hasMore", async () => {
    const tenant = await company();
    const otherTenant = await company("Outra");
    await membership(tenant.id);
    modules.repositories.notifications.items.push(
      notification(
        tenant.id,
        USER_ID,
        "10000000-0000-4000-8000-000000000001",
        "2026-08-14T10:00:00Z",
      ),
      notification(
        tenant.id,
        USER_ID,
        "10000000-0000-4000-8000-000000000002",
        "2026-08-14T11:00:00Z",
      ),
      notification(
        tenant.id,
        THIRD_USER_ID,
        "10000000-0000-4000-8000-000000000003",
        "2026-08-14T12:00:00Z",
      ),
      notification(
        otherTenant.id,
        USER_ID,
        "10000000-0000-4000-8000-000000000004",
        "2026-08-14T13:00:00Z",
      ),
    );

    const response = await app.inject({
      method: "GET",
      url: `/companies/${tenant.id}/notifications?limit=1`,
      headers: await headers(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      unreadCount: 2,
      hasMore: true,
      items: [{ id: "10000000-0000-4000-8000-000000000002", userId: USER_ID }],
    });
  });

  it("marca a própria notificação como lida de forma idempotente e oculta terceiros/tenant", async () => {
    const tenant = await company();
    const otherTenant = await company("Outra");
    await membership(tenant.id);
    await membership(tenant.id, THIRD_USER_ID);
    await membership(otherTenant.id);
    const own = notification(
      tenant.id,
      USER_ID,
      "10000000-0000-4000-8000-000000000001",
      "2026-08-14T10:00:00Z",
    );
    modules.repositories.notifications.items.push(own);

    const url = `/companies/${tenant.id}/notifications/${own.id}/read`;
    const first = await app.inject({ method: "PATCH", url, headers: await headers() });
    const second = await app.inject({ method: "PATCH", url, headers: await headers() });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().readAt).toBe(first.json().readAt);

    const thirdParty = await app.inject({
      method: "PATCH",
      url,
      headers: await headers(THIRD_USER_ID),
    });
    expect(thirdParty.statusCode).toBe(404);

    const crossTenant = await app.inject({
      method: "PATCH",
      url: `/companies/${otherTenant.id}/notifications/${own.id}/read`,
      headers: await headers(),
    });
    expect(crossTenant.statusCode).toBe(404);
  });

  it("rejeita readAt ou qualquer body definido pelo cliente", async () => {
    const tenant = await company();
    await membership(tenant.id);
    const own = notification(
      tenant.id,
      USER_ID,
      "10000000-0000-4000-8000-000000000001",
      "2026-08-14T10:00:00Z",
    );
    modules.repositories.notifications.items.push(own);

    const response = await app.inject({
      method: "PATCH",
      url: `/companies/${tenant.id}/notifications/${own.id}/read`,
      headers: await headers(),
      payload: { readAt: "2026-08-14T12:00:00Z" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    expect(own.readAt).toBeNull();
  });

  it("retorna defaults e atualiza preferência com payload estrito e tenant scoped", async () => {
    const tenant = await company();
    const otherTenant = await company("Outra");
    await membership(tenant.id);
    await membership(otherTenant.id);
    const authorization = await headers();

    const defaults = await app.inject({
      method: "GET",
      url: `/companies/${tenant.id}/notification-preferences`,
      headers: authorization,
    });
    expect(defaults.statusCode).toBe(200);
    expect(defaults.json().items).toHaveLength(5);
    expect(
      defaults.json().items.every((item: { inAppEnabled: boolean }) => item.inAppEnabled),
    ).toBe(true);

    const updated = await app.inject({
      method: "PATCH",
      url: `/companies/${tenant.id}/notification-preferences`,
      headers: authorization,
      payload: { eventType: "TASK_ASSIGNED", inAppEnabled: false },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toEqual({ eventType: "TASK_ASSIGNED", inAppEnabled: false });

    const otherDefaults = await app.inject({
      method: "GET",
      url: `/companies/${otherTenant.id}/notification-preferences`,
      headers: authorization,
    });
    expect(otherDefaults.json().items[0]).toEqual({
      eventType: "TASK_ASSIGNED",
      inAppEnabled: true,
    });
  });

  it.each([
    { eventType: "INVALID", inAppEnabled: true },
    { eventType: "TASK_ASSIGNED", inAppEnabled: true, unknown: true },
  ])("rejeita evento inválido e campo desconhecido: $eventType", async (payload) => {
    const tenant = await company();
    await membership(tenant.id);
    const response = await app.inject({
      method: "PATCH",
      url: `/companies/${tenant.id}/notification-preferences`,
      headers: await headers(),
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("documenta os quatro paths e respostas HTTP relevantes", async () => {
    await app.ready();
    const document = app.swagger();
    const expected = ["200", "400", "401", "403", "404", "422"];
    const operations = [
      document.paths?.["/companies/{companyId}/notifications"]?.get,
      document.paths?.["/companies/{companyId}/notifications/{notificationId}/read"]?.patch,
      document.paths?.["/companies/{companyId}/notification-preferences"]?.get,
      document.paths?.["/companies/{companyId}/notification-preferences"]?.patch,
    ];

    for (const operation of operations) {
      expect(operation?.description).toBeTruthy();
      expect(Object.keys(operation?.responses ?? {})).toEqual(expected);
      for (const response of Object.values(operation?.responses ?? {})) {
        expect(response).toHaveProperty("description");
      }
    }
  });
});
