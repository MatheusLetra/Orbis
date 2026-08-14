import { describe, expect, it } from "vitest";

import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import { buildTestModules } from "@/test/modules-test-helper";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function requisition(
  id: string,
  overrides: Partial<Parameters<typeof Requisition.restore>[0]>,
): Requisition {
  return Requisition.restore({
    id,
    companyId: COMPANY_ID,
    number: 1,
    title: "Requisição",
    description: null,
    priority: "MEDIUM",
    status: "OPEN",
    requesterId: USER_ID,
    responsibleId: null,
    systemId: null,
    systemVersionId: null,
    estimatedHours: null,
    startDate: null,
    plannedDeliveryDate: null,
    deliveredAt: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  });
}

describe("GetMonthlyRequisitionTimeline", () => {
  it("aplica interseção inclusiva, pontos, sem datas e indicadores do período", async () => {
    const modules = buildTestModules();
    await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "GESTOR" }),
    );
    await modules.repositories.requisitions.create(
      requisition("33333333-3333-4333-8333-333333333333", {
        number: 1,
        title: "Atravessa",
        startDate: new Date("2026-07-31T00:00:00Z"),
        plannedDeliveryDate: new Date("2026-08-01T00:00:00Z"),
        estimatedHours: 3,
      }),
    );
    await modules.repositories.requisitions.create(
      requisition("44444444-4444-4444-8444-444444444444", {
        number: 2,
        title: "Ponto",
        startDate: new Date("2026-08-15T00:00:00Z"),
        estimatedHours: 2,
        deliveredAt: new Date("2026-08-15T23:00:00Z"),
        plannedDeliveryDate: new Date("2026-08-15T00:00:00Z"),
      }),
    );
    await modules.repositories.requisitions.create(
      requisition("55555555-5555-4555-8555-555555555555", {
        number: 3,
        title: "Invertida",
        startDate: new Date("2026-08-20T00:00:00Z"),
        plannedDeliveryDate: new Date("2026-08-10T00:00:00Z"),
        estimatedHours: 4,
      }),
    );
    await modules.repositories.requisitions.create(
      requisition("66666666-6666-4666-8666-666666666666", {
        number: 4,
        title: "Sem datas",
        estimatedHours: 1,
      }),
    );

    const result = await modules.timeline.getMonthly.execute({
      actor: { userId: USER_ID, companyId: COMPANY_ID, permissions: ["requisitions.read"] },
      companyId: COMPANY_ID,
      period: "2026-08",
    });
    expect(result.items.map((item) => item.title)).toEqual(["Atravessa", "Ponto"]);
    expect(result.undatedItems.map((item) => item.title)).toEqual(["Invertida", "Sem datas"]);
    expect(result.indicators).toEqual({
      totalRequisitions: 4,
      estimatedHours: 10,
      deliveredOnTime: 1,
      overdue: 0,
    });
    expect(result.items[1]).toMatchObject({ isOverdue: false, deliveredOnTime: true });
  });

  it("exige requisitions.read, membership ativa e empresa ativa", async () => {
    const modules = buildTestModules();
    await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "GESTOR" }),
    );
    const command = {
      actor: { userId: USER_ID, companyId: COMPANY_ID, permissions: [] as const },
      companyId: COMPANY_ID,
      period: "2026-08",
    };
    await expect(modules.timeline.getMonthly.execute(command)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      modules.timeline.getMonthly.execute({
        ...command,
        actor: { ...command.actor, permissions: ["requisitions.read"] },
      }),
    ).resolves.toMatchObject({ indicators: { totalRequisitions: 0 } });
  });

  it("normaliza horas nulas e calcula atraso e indicadores com todas as listas", async () => {
    const modules = buildTestModules();
    await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
    await modules.repositories.memberships.create(
      Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "GESTOR" }),
    );
    await modules.repositories.requisitions.create(
      requisition("77777777-7777-4777-8777-777777777777", {
        plannedDeliveryDate: new Date("2026-07-31T00:00:00Z"),
      }),
    );

    const result = await modules.timeline.getMonthly.execute({
      actor: { userId: USER_ID, companyId: COMPANY_ID, permissions: ["requisitions.read"] },
      companyId: COMPANY_ID,
      period: "2026-08",
    });

    expect(result.items[0]).toMatchObject({
      estimatedHours: 0,
      isOverdue: true,
      deliveredOnTime: false,
    });
    expect(result.indicators).toEqual({
      totalRequisitions: 1,
      estimatedHours: 0,
      deliveredOnTime: 0,
      overdue: 1,
    });
    expect(Object.keys(result.items[0])).toEqual([
      "requisitionId",
      "number",
      "title",
      "priority",
      "assigneeId",
      "startDate",
      "plannedDeliveryDate",
      "deliveredAt",
      "estimatedHours",
      "isOverdue",
      "deliveredOnTime",
    ]);
  });
});
