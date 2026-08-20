import { describe, expect, it } from "vitest";

import { loadEnv } from "@/config/env";
import { buildModules } from "@/infrastructure/composition-root";
import type { Database } from "@/infrastructure/database/client";

function databaseThatMustNotBeUsed(): Database {
  return new Proxy({} as Database, {
    get() {
      throw new Error("O composition root não deve acessar o banco durante a construção");
    },
  });
}

describe("buildModules", () => {
  it("constrói todos os módulos sem abrir conexão com PostgreSQL", () => {
    const modules = buildModules(databaseThatMustNotBeUsed(), loadEnv({ NODE_ENV: "test" }));

    const useCases = [
      modules.createUser,
      modules.createCompany,
      modules.getCompany,
      modules.listCompanies,
      modules.updateCompany,
      modules.createMembership,
      modules.listMemberships,
      modules.listCompanyMembers,
      modules.getAvailableDevelopers,
      modules.calculateCapacity,
      modules.getDailyHoursPerDeveloper,
      modules.setDailyHoursPerDeveloper,
      ...Object.values(modules.requisitions),
      ...Object.values(modules.systems),
      ...Object.values(modules.versions),
      ...Object.values(modules.releases),
      ...Object.values(modules.tasks),
      ...Object.values(modules.attachments),
      ...Object.values(modules.auth),
    ];

    expect(useCases).toHaveLength(51);
    expect(useCases.every((useCase) => typeof useCase.execute === "function")).toBe(true);
    expect(typeof modules.permissionResolver.resolve).toBe("function");
    expect(typeof modules.tokenService.signAccessToken).toBe("function");
    expect(typeof modules.tokenService.verifyAccessToken).toBe("function");
  });

  it("rejeita TTL de refresh inválido durante a composição", () => {
    expect(() =>
      buildModules(
        databaseThatMustNotBeUsed(),
        loadEnv({ NODE_ENV: "test", JWT_REFRESH_TTL: "1x" }),
      ),
    ).toThrow('TTL inválido: "1x"');
  });
});
