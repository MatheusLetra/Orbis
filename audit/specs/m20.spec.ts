import { expect, test } from "@playwright/test";
import { fixture } from "../fixtures/fixture-types";

test.describe("@m20 M20 hardening e releases por localização", () => {
  test("valida lifecycle, request id, headers e localização manual", async ({ request }) => {
    const live = await request.get(`${process.env.AUDIT_API_URL}/health/live`);
    expect(live.status()).toBe(200);
    expect(live.headers()["x-request-id"]).toBeTruthy();
    expect(live.headers()["x-content-type-options"]).toBe("nosniff");
    expect(live.headers()["x-frame-options"]).toBe("DENY");

    const ready = await request.get(`${process.env.AUDIT_API_URL}/health/ready`);
    expect(ready.status()).toBe(200);

    const login = await request.post(`${process.env.AUDIT_API_URL}/auth/login`, {
      data: { email: fixture.actorEmail, password: fixture.actorPassword },
      headers: { "X-Request-ID": "m20-login" },
    });
    expect(login.status()).toBe(200);
    expect(login.headers()["x-request-id"]).toBe("m20-login");
    const { accessToken } = await login.json();
    const headers = { Authorization: `Bearer ${accessToken}` };

    const created = await request.post(`${process.env.AUDIT_API_URL}/companies/${fixture.companyA}/releases`, {
      headers,
      data: { systemVersionId: fixture.m20Version, versionLabel: "20.0.0" },
    });
    expect(created.status()).toBe(201);
    const release = await created.json();

    const published = await request.post(
      `${process.env.AUDIT_API_URL}/companies/${fixture.companyA}/releases/${release.id}/publish`,
      { headers, data: { artifactName: "orbis.exe", artifactLocation: "  https://downloads.example.test/orbis.exe  " } },
    );
    expect(published.status()).toBe(200);
    expect((await published.json()).artifactLocation).toBe("https://downloads.example.test/orbis.exe");

    const second = await request.post(
      `${process.env.AUDIT_API_URL}/companies/${fixture.companyA}/releases/${release.id}/publish`,
      { headers, data: { artifactName: "orbis.exe", artifactLocation: "/local/orbis.exe" } },
    );
    expect(second.status()).toBe(409);

    const detail = await request.get(
      `${process.env.AUDIT_API_URL}/companies/${fixture.companyA}/releases/${release.id}`,
      { headers },
    );
    expect((await detail.json()).artifactLocation).toBe("https://downloads.example.test/orbis.exe");

    const openapi = await request.get(`${process.env.AUDIT_API_URL}/reference/openapi.json`);
    const paths = Object.keys((await openapi.json()).paths);
    expect(paths.some((path) => path.includes("releases") && path.includes("file"))).toBeFalsy();
  });
});
