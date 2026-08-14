import { describe, expect, it, vi } from "vitest";
import { buildApp } from "@/app";
import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import type { TaskReportReadModel } from "@/modules/reports/application/read-models/task-report";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const item = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "CSV task",
  status: "DONE" as const,
  priority: "HIGH" as const,
  issuedAt: "2026-08-01T00:00:00.000Z",
  plannedEndDate: null,
  completedAt: null,
  assigneeId: null,
  assigneeName: null,
  requisitionId: null,
  requisitionNumber: null,
  requisitionTitle: null,
  estimatedHours: null,
  workedHours: 0,
};

async function build() {
  const modules = buildTestModules();
  await modules.repositories.companies.create(Company.create({ name: "A" }, COMPANY));
  await modules.repositories.memberships.create(
    Membership.create({ companyId: COMPANY, userId: USER, position: "GESTOR" }),
  );
  const getTaskReport = {
    execute: vi.fn(
      async (): Promise<TaskReportReadModel> => ({
        companyId: COMPANY,
        items: [item],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
      }),
    ),
  };
  const app = await buildApp({
    logger: false,
    modules: { ...modules, reports: { getTaskReport } } as TestModules,
  });
  const authorization = {
    authorization: `Bearer ${await modules.tokenService.signAccessToken(USER)}`,
  };
  return { app, authorization, getTaskReport };
}
describe("relatórios HTTP/OpenAPI", () => {
  it("documenta JSON/CSV e retorna relatório tenant-aware", async () => {
    const { app, authorization, getTaskReport } = await build();
    await app.ready();
    expect(app.swagger().paths["/companies/{companyId}/reports/tasks"]).toBeDefined();
    const json = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/reports/tasks?status=DONE`,
      headers: authorization,
    });
    expect(json.statusCode).toBe(200);
    expect(json.json().items[0].workedHours).toBe(0);
    const csv = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/reports/tasks/export?status=DONE`,
      headers: authorization,
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toContain("attachment");
    expect(getTaskReport.execute).toHaveBeenCalled();
    await app.close();
  });
  it("rejeita query desconhecida e período inválido", async () => {
    const { app, authorization } = await build();
    const unknown = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/reports/tasks?unexpected=true`,
      headers: authorization,
    });
    const invalid = await app.inject({
      method: "GET",
      url: `/companies/${COMPANY}/reports/tasks?periodStart=2026-01-02&periodEnd=2026-01-01`,
      headers: authorization,
    });
    expect(unknown.statusCode).toBe(400);
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });
});
