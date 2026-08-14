import { describe, expect, it } from "vitest";

import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import { buildTestModules } from "@/test/modules-test-helper";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function requisition(id: string, overrides: Partial<Parameters<typeof Requisition.restore>[0]>) {
  return Requisition.restore({
    id,
    companyId: COMPANY_ID,
    number: 1,
    title: "Requisição",
    description: null,
    priority: "MEDIUM",
    status: "OPEN",
    requesterId: USER_ID,
    responsibleId: USER_ID,
    systemId: null,
    systemVersionId: null,
    estimatedHours: null,
    startDate: null,
    plannedDeliveryDate: null,
    deliveredAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

describe("GetYearlyRequisitionTimeline", () => {
  it("gera janeiro a dezembro, distribui intervalos, agrupa prioridades e mantém undated", async () => {
    const modules = buildTestModules();
    await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "GESTOR" }),
    );
    await modules.repositories.requisitions.create(
      requisition("33333333-3333-4333-8333-333333333333", {
        number: 2,
        title: "Atravessa",
        priority: "HIGH",
        startDate: new Date("2026-01-31T00:00:00Z"),
        plannedDeliveryDate: new Date("2026-03-01T00:00:00Z"),
        estimatedHours: 3,
      }),
    );
    await modules.repositories.requisitions.create(
      requisition("44444444-4444-4444-8444-444444444444", {
        number: 1,
        title: "Ponto",
        startDate: new Date("2026-02-10T00:00:00Z"),
        plannedDeliveryDate: new Date("2026-02-10T00:00:00Z"),
        estimatedHours: 2,
        deliveredAt: new Date("2026-02-10T23:00:00Z"),
      }),
    );
    await modules.repositories.requisitions.create(
      requisition("55555555-5555-4555-8555-555555555555", {
        number: 3,
        title: "Invertida",
        startDate: new Date("2026-04-20T00:00:00Z"),
        plannedDeliveryDate: new Date("2026-04-10T00:00:00Z"),
        estimatedHours: 4,
      }),
    );
    const result = await modules.timeline.getYearly.execute({
      actor: { userId: USER_ID, companyId: COMPANY_ID, permissions: ["requisitions.read"] },
      companyId: COMPANY_ID,
      year: "2026",
    });
    expect(result.months).toHaveLength(12);
    expect(result.months[0]).toMatchObject({
      period: "2026-01",
      requisitionCount: 2,
      estimatedHours: 7,
      countsByPriority: { HIGH: 1, MEDIUM: 1, LOW: 0 },
    });
    expect(result.months[1].items.map((item) => item.title)).toEqual(["Ponto", "Atravessa"]);
    expect(result.months[2].items.map((item) => item.title)).toEqual(["Atravessa"]);
    expect(result.months[0].undatedItems.map((item) => item.title)).toEqual(["Invertida"]);
    expect(result.indicators).toEqual({
      totalRequisitions: 3,
      estimatedHours: 9,
      deliveredOnTime: 1,
      overdue: 0,
    });
  });

  it("valida ano, filtros e autorização", async () => {
    const modules = buildTestModules();
    await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "GESTOR" }),
    );
    const command = {
      actor: { userId: USER_ID, companyId: COMPANY_ID, permissions: [] as const },
      companyId: COMPANY_ID,
      year: "20x6",
    };
    await expect(modules.timeline.getYearly.execute(command)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      modules.timeline.getYearly.execute({
        ...command,
        year: "2026",
        actor: { ...command.actor, permissions: ["requisitions.read"] },
      }),
    ).resolves.toMatchObject({ months: expect.any(Array) });
  });
});
