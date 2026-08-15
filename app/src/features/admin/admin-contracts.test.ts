import { describe, expect, it } from "vitest";
import {
  parseAuditPage,
  parseCapacitySettings,
  parseCompanies,
  parseCompany,
  parseMember,
  parseMembers,
  parseRelease,
  parseReleases,
  parseRequisition,
  parseRequisitions,
  parseSystem,
  parseSystems,
  parseVersion,
  parseVersions,
} from "./admin-contracts";

describe("admin contracts", () => {
  it("normaliza a membership administrativa", () => {
    expect(
      parseMember({
        id: "membership-a",
        companyId: "company-a",
        userId: "user-a",
        name: "Ana",
        email: "ana@example.com",
        position: "GESTOR",
        permissions: ["audit.read"],
        isActive: true,
        userIsActive: true,
        createdAt: "2026-08-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      }),
    ).toMatchObject({ membershipId: "membership-a", userId: "user-a", isActive: true });
  });

  it("aceita capacidade ainda não configurada", () => {
    expect(parseCapacitySettings({ companyId: "company-a", dailyHoursPerDeveloper: null })).toEqual(
      { companyId: "company-a", dailyHoursPerDeveloper: null },
    );
  });

  it("rejeita release sem vínculo de versão", () => {
    expect(() => parseRelease({ id: "release-a" })).toThrow("Contrato de release inválido");
  });

  it.each([
    ["empresa", () => parseCompany(null)],
    ["empresas", () => parseCompanies({})],
    [
      "configuração de capacidade",
      () => parseCapacitySettings({ companyId: "a", dailyHoursPerDeveloper: "8" }),
    ],
    [
      "membro",
      () =>
        parseMember({
          id: "m",
          userId: "u",
          email: "e",
          name: "n",
          position: "p",
          permissions: ["invalid"],
          userIsActive: true,
        }),
    ],
    ["membros", () => parseMembers(null)],
    ["sistema", () => parseSystem({ id: "s" })],
    ["sistemas", () => parseSystems(null)],
    ["versão", () => parseVersion({ id: "v" })],
    ["versões", () => parseVersions(null)],
    ["requisição", () => parseRequisition({ id: "r" })],
    ["requisições", () => parseRequisitions(null)],
    ["releases", () => parseReleases(null)],
    ["auditoria", () => parseAuditPage({ companyId: "a", items: "bad" })],
  ])("rejeita contrato inválido de %s", (_name, parse) => {
    expect(parse).toThrow(/Contrato de/);
  });
});
