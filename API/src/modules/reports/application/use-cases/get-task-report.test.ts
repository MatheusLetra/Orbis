import { describe, expect, it } from "vitest";
import { Company } from "@/modules/companies/domain/entities/company";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type {
  TaskReportQuery,
  TaskReportReadRepository,
} from "@/modules/reports/application/ports/task-report-read-repository";
import { GetTaskReport } from "@/modules/reports/application/use-cases/get-task-report";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { buildTestModules } from "@/test/modules-test-helper";

const companyId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const repository: TaskReportReadRepository = {
  find: async (_query: TaskReportQuery) => ({ items: [], total: 0 }),
};
const actor: AuthenticatedUser = { userId, companyId, permissions: ["tasks.read"] };

describe("GetTaskReport", () => {
  it("valida autorização, empresa e paginação do read model", async () => {
    const modules = buildTestModules();
    await modules.repositories.companies.create(Company.create({ name: "Orbis" }, companyId));
    await modules.repositories.memberships.create(
      Membership.create({ companyId, userId, position: "GESTOR" }),
    );
    const useCase = new GetTaskReport(
      repository,
      modules.repositories.companies,
      new MembershipAccessService(modules.repositories.memberships),
      new AuthorizationService(),
    );
    await expect(useCase.execute({ actor, companyId, filters: {} })).resolves.toMatchObject({
      companyId,
      page: 1,
      limit: 50,
      total: 0,
      hasMore: false,
    });
  });
  it("rejeita tenant divergente e filtros inválidos", async () => {
    const modules = buildTestModules();
    const useCase = new GetTaskReport(
      repository,
      modules.repositories.companies,
      new MembershipAccessService(modules.repositories.memberships),
      new AuthorizationService(),
    );
    await expect(
      useCase.execute({ actor, companyId: "33333333-3333-4333-8333-333333333333", filters: {} }),
    ).rejects.toThrow();
    await expect(
      useCase.execute({ actor, companyId, filters: { periodStart: "2026-01-01" } }),
    ).rejects.toThrow();
  });
});
