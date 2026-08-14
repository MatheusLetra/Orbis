import { describe, expect, it } from "vitest";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { buildTestModules } from "@/test/modules-test-helper";

const companyId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const otherCompanyId = "33333333-3333-4333-8333-333333333333";

describe("ListAuditLogs", () => {
  it("exige tenant ativo, membership e audit.read e lista somente o tenant", async () => {
    const modules = buildTestModules();
    await modules.repositories.companies.create(Company.create({ name: "A" }, companyId));
    await modules.repositories.companies.create(Company.create({ name: "B" }, otherCompanyId));
    const membership = Membership.create({ companyId, userId, position: "GESTOR" });
    membership.changePermissions(["audit.read"]);
    await modules.repositories.memberships.create(membership);
    await modules.auditRecorder.record({
      companyId,
      actorUserId: userId,
      action: "COMPANY_UPDATED",
      entityType: "COMPANY",
      entityId: companyId,
      metadata: { changedFields: ["name"] },
    });
    await modules.auditRecorder.record({
      companyId: otherCompanyId,
      actorUserId: userId,
      action: "COMPANY_UPDATED",
      entityType: "COMPANY",
      entityId: otherCompanyId,
      metadata: null,
    });

    await expect(
      modules.audit.list.execute({
        actor: { userId, companyId, permissions: ["audit.read"] },
        companyId,
        query: { limit: 50 },
      }),
    ).resolves.toMatchObject({ companyId, items: [{ entityId: companyId }], hasMore: false });
  });

  it("rejeita ausência de permissão, tenant divergente e filtros inválidos", async () => {
    const modules = buildTestModules();
    await modules.repositories.companies.create(Company.create({ name: "A" }, companyId));
    await modules.repositories.memberships.create(
      Membership.create({ companyId, userId, position: "SUPORTE" }),
    );
    await expect(
      modules.audit.list.execute({
        actor: { userId, companyId, permissions: [] },
        companyId,
        query: { limit: 50 },
      }),
    ).rejects.toThrow();
    await expect(
      modules.audit.list.execute({
        actor: { userId, companyId, permissions: ["audit.read"] },
        companyId: otherCompanyId,
        query: { limit: 50 },
      }),
    ).rejects.toThrow();
    await expect(
      modules.audit.list.execute({
        actor: { userId, companyId, permissions: ["audit.read"] },
        companyId,
        query: { limit: 0 },
      }),
    ).rejects.toThrow();
  });
});
