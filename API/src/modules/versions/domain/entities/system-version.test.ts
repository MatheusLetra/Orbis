import { describe, expect, it } from "vitest";
import { SystemVersion } from "@/modules/versions/domain/entities/system-version";

describe("SystemVersion", () => {
  it("cria uma versão ativa", () => {
    const version = SystemVersion.create({
      companyId: "company-1",
      systemId: "system-1",
      version: "1.2.3",
    });

    expect(version.companyId).toBe("company-1");
    expect(version.systemId).toBe("system-1");
    expect(version.version).toBe("1.2.3");
    expect(version.isActive).toBe(true);
  });

  it("restaura a partir de props", () => {
    const now = new Date();
    const version = SystemVersion.restore({
      id: "version-1",
      companyId: "company-1",
      systemId: "system-1",
      version: "2.0.0",
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    expect(version.id).toBe("version-1");
    expect(version.version).toBe("2.0.0");
    expect(version.isActive).toBe(false);
  });

  it("changeVersion atualiza a versão", () => {
    const version = SystemVersion.create({
      companyId: "company-1",
      systemId: "system-1",
      version: "1.0.0",
    });

    version.changeVersion("1.1.0");

    expect(version.version).toBe("1.1.0");
    expect(version.updatedAt.getTime()).toBeGreaterThanOrEqual(version.createdAt.getTime());
  });

  it("deactivate e reactivate alternam isActive", () => {
    const version = SystemVersion.create({
      companyId: "company-1",
      systemId: "system-1",
      version: "1.0.0",
    });

    version.deactivate();
    expect(version.isActive).toBe(false);

    version.reactivate();
    expect(version.isActive).toBe(true);
  });
});
