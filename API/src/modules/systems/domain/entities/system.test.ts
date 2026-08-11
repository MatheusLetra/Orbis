import { describe, expect, it } from "vitest";
import { System } from "@/modules/systems/domain/entities/system";

describe("System", () => {
  it("cria um sistema ativo com description null quando ausente", () => {
    const system = System.create({ companyId: "company-1", name: "ERP" });

    expect(system.name).toBe("ERP");
    expect(system.companyId).toBe("company-1");
    expect(system.description).toBeNull();
    expect(system.isActive).toBe(true);
    expect(system.createdAt).toBeInstanceOf(Date);
  });

  it("trata description em branco como null", () => {
    const system = System.create({ companyId: "company-1", name: "ERP", description: "  " });

    expect(system.description).toBeNull();
  });

  it("restaura um sistema a partir de props", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const system = System.restore({
      id: "system-1",
      companyId: "company-1",
      name: "ERP",
      description: "Sistema interno",
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    expect(system.id).toBe("system-1");
    expect(system.name).toBe("ERP");
    expect(system.isActive).toBe(false);
  });

  it("rename e changeDescription atualizam updatedAt", () => {
    const system = System.create({ companyId: "company-1", name: "ERP" });
    const before = system.updatedAt;

    system.rename("ERP Novo");
    system.changeDescription("Descrição");

    expect(system.name).toBe("ERP Novo");
    expect(system.description).toBe("Descrição");
    expect(system.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("deactivate e reactivate alternam isActive", () => {
    const system = System.create({ companyId: "company-1", name: "ERP" });

    system.deactivate();
    expect(system.isActive).toBe(false);

    system.reactivate();
    expect(system.isActive).toBe(true);
  });
});
