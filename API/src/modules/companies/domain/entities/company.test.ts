import { describe, expect, it } from "vitest";
import { Company } from "./company.js";

const base = { name: "Orbis Corp" };

describe("Company", () => {
  it("cria com valores padrão", () => {
    const company = Company.create(base);

    expect(company.name).toBe("Orbis Corp");
    expect(company.timezone).toBe("America/Sao_Paulo");
    expect(company.settings).toEqual({});
    expect(company.isActive).toBe(true);
    expect(company.createdAt).toBeInstanceOf(Date);
    expect(company.updatedAt).toBeInstanceOf(Date);
  });

  it("cria com timezone e settings fornecidos", () => {
    const company = Company.create({
      ...base,
      timezone: "America/New_York",
      settings: { segment: "tech" },
    });

    expect(company.timezone).toBe("America/New_York");
    expect(company.settings).toEqual({ segment: "tech" });
  });

  it("restaura a partir de props", () => {
    const now = new Date();
    const company = Company.restore({
      id: "abc-123",
      name: "Outra",
      timezone: "UTC",
      settings: {},
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    expect(company.id).toBe("abc-123");
    expect(company.isActive).toBe(false);
  });

  it("compara identidade pelo id", () => {
    const a = Company.create(base, "id-1");
    const b = Company.create(base, "id-1");
    const c = Company.create(base, "id-2");

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it("renomeia e atualiza updatedAt", async () => {
    const company = Company.create(base);
    const before = company.updatedAt;

    company.rename("Orbis SA");

    expect(company.name).toBe("Orbis SA");
    expect(company.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("altera timezone e settings", () => {
    const company = Company.create(base);

    company.changeTimezone("UTC");
    company.changeSettings({ theme: "dark" });

    expect(company.timezone).toBe("UTC");
    expect(company.settings).toEqual({ theme: "dark" });
  });

  it("desativa e reativa", () => {
    const company = Company.create(base);

    company.deactivate();
    expect(company.isActive).toBe(false);

    company.reactivate();
    expect(company.isActive).toBe(true);
  });
});
