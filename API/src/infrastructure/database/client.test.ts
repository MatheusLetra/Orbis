import { describe, expect, it } from "vitest";
import { createDb } from "./client";

describe("createDb", () => {
  it("usa a DATABASE_URL padrão quando nada é informado", () => {
    const db = createDb();
    expect(db).toBeDefined();
  });

  it("aceita uma URL explícita", () => {
    const db = createDb("postgres://postgres:postgres@localhost:5432/orbis");
    expect(db).toBeDefined();
  });
});
