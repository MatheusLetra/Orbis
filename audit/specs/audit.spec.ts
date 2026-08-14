import { expect, test } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";

test.describe("@m19 M19 auditoria", () => {
  test("consulta os eventos aprovados, pagina e mantém metadata mínima", async ({ page, request }) => {
    const login = await request.post(`${process.env.AUDIT_API_URL}/auth/login`, {
      data: { email: fixture.actorEmail, password: fixture.actorPassword },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = await login.json();
    const headers = { Authorization: `Bearer ${accessToken}` };

    const first = await request.get(`${process.env.AUDIT_API_URL}/companies/${fixture.companyA}/audit?limit=3`, { headers });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.companyId).toBe(fixture.companyA);
    expect(firstBody.items.length).toBe(3);
    expect(firstBody.items[0].createdAt >= firstBody.items[1].createdAt).toBeTruthy();
    expect(firstBody.items[0].metadata).not.toHaveProperty("password");
    expect(firstBody.items[0].metadata).not.toHaveProperty("token");
    expect(JSON.stringify(firstBody)).not.toContain(fixture.actorPassword);
    expect(firstBody.nextCursor).toBeTruthy();

    const next = await request.get(
      `${process.env.AUDIT_API_URL}/companies/${fixture.companyA}/audit?limit=3&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      { headers },
    );
    expect(next.status()).toBe(200);
    expect((await next.json()).items[0].id).not.toBe(firstBody.items[0].id);

    const actions = await request.get(
      `${process.env.AUDIT_API_URL}/companies/${fixture.companyA}/audit?action=TASK_STATUS_CHANGED`,
      { headers },
    );
    expect((await actions.json()).items).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "TASK_STATUS_CHANGED", entityId: fixture.taskOwn }),
    ]));

    const companyB = await request.get(`${process.env.AUDIT_API_URL}/companies/${fixture.companyB}/audit`, { headers });
    expect(companyB.status()).toBe(200);
    expect((await companyB.json()).items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: fixture.companyB }),
    ]));

    const scalarErrors: string[] = [];
    page.on("pageerror", (error) => scalarErrors.push(error.message));
    await page.goto(`${process.env.AUDIT_API_URL}/reference`);
    await expect(page).toHaveTitle(/Scalar|Orbis/i);
    expect(scalarErrors).toEqual([]);
    const openapi = await request.get(`${process.env.AUDIT_API_URL}/reference/openapi.json`);
    expect(openapi.status()).toBe(200);
    expect((await openapi.json()).paths["/companies/{companyId}/audit"]).toBeDefined();
  });

  test("nega consulta para ator sem audit.read e preserva isolamento", async ({ request }) => {
    const login = await request.post(`${process.env.AUDIT_API_URL}/auth/login`, {
      data: { email: fixture.thirdEmail, password: fixture.thirdPassword },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = await login.json();
    const response = await request.get(`${process.env.AUDIT_API_URL}/companies/${fixture.companyA}/audit`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(response.status()).toBe(403);
  });
});
