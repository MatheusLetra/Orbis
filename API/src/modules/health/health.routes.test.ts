import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";

describe("GET /health", () => {
  it("responde com status ok", async () => {
    const app = await buildApp({ logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "orbis-api",
    });

    await app.close();
  });
});
