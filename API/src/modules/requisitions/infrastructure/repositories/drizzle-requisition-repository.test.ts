import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import { companies, users } from "@/infrastructure/database/schema";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import { DrizzleRequisitionRepository } from "@/modules/requisitions/infrastructure/repositories/drizzle-requisition-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const REQUESTER_ID = "33333333-3333-4333-8333-333333333333";
const RESPONSIBLE_ID = "44444444-4444-4444-8444-444444444444";
const REQUISITION_A = "55555555-5555-4555-8555-555555555555";
const REQUISITION_B = "66666666-6666-4666-8666-666666666666";

function buildRequisition(
  id = REQUISITION_A,
  companyId = COMPANY_A,
  overrides: Partial<Parameters<typeof Requisition.restore>[0]> = {},
): Requisition {
  const createdAt = overrides.createdAt ?? new Date("2026-08-12T10:00:00Z");

  return Requisition.restore({
    id,
    companyId,
    number: 7,
    title: "Requisição de teste",
    description: "Descrição",
    priority: "HIGH",
    status: "OPEN",
    requesterId: REQUESTER_ID,
    responsibleId: null,
    systemId: null,
    systemVersionId: null,
    estimatedHours: 8.5,
    startDate: new Date("2026-08-13T00:00:00Z"),
    plannedDeliveryDate: new Date("2026-08-20T00:00:00Z"),
    deliveredAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

describe.skipIf(!available)("DrizzleRequisitionRepository", () => {
  let db: Database;
  let repository: DrizzleRequisitionRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleRequisitionRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE requisitions, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC" },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC" },
    ]);
    await db.insert(users).values([
      {
        id: REQUESTER_ID,
        email: "requester@example.com",
        name: "Requester",
        passwordHash: "hash",
      },
      {
        id: RESPONSIBLE_ID,
        email: "responsible@example.com",
        name: "Responsible",
        passwordHash: "hash",
      },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("cria e busca uma requisição", async () => {
    const created = await repository.create(buildRequisition());

    const found = await repository.findById(created.id);

    expect(found).toMatchObject({
      id: created.id,
      companyId: COMPANY_A,
      number: 7,
      priority: "HIGH",
      status: "OPEN",
    });
  });

  it("retorna null quando não encontra uma requisição", async () => {
    await expect(repository.findById(REQUISITION_A)).resolves.toBeNull();
  });

  it("preserva nulls, datas, enums e number", async () => {
    const original = buildRequisition(undefined, undefined, {
      description: null,
      responsibleId: null,
      systemId: null,
      systemVersionId: null,
      estimatedHours: null,
      startDate: null,
      plannedDeliveryDate: null,
      deliveredAt: null,
      number: 42,
      priority: "LOW",
      status: "CANCELLED",
    });

    const created = await repository.create(original);
    const found = await repository.findById(created.id);

    expect(found).toMatchObject({
      number: 42,
      description: null,
      responsibleId: null,
      estimatedHours: null,
      startDate: null,
      plannedDeliveryDate: null,
      deliveredAt: null,
      priority: "LOW",
      status: "CANCELLED",
    });
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it("atualiza e persiste updatedAt", async () => {
    const created = await repository.create(buildRequisition());
    const updatedAt = new Date("2026-08-14T12:00:00Z");
    created.rename("Atualizada");
    Object.defineProperty(created, "updatedAt", { value: updatedAt });

    const updated = await repository.update(created);

    expect(updated.title).toBe("Atualizada");
    expect(updated.updatedAt).toEqual(updatedAt);
  });

  it("exclui uma requisição", async () => {
    const created = await repository.create(buildRequisition());

    await repository.delete(created.id);

    await expect(repository.findById(created.id)).resolves.toBeNull();
  });

  it("isola empresas na listagem", async () => {
    await repository.create(buildRequisition(REQUISITION_A, COMPANY_A));
    await repository.create(buildRequisition(REQUISITION_B, COMPANY_B));

    const result = await repository.listByCompany(COMPANY_A);

    expect(result.map((item) => item.companyId)).toEqual([COMPANY_A]);
  });

  it("filtra por status, priority e responsibleId", async () => {
    await repository.create(
      buildRequisition(REQUISITION_A, COMPANY_A, {
        number: 8,
        status: "DONE",
        priority: "LOW",
        responsibleId: RESPONSIBLE_ID,
      }),
    );
    await repository.create(
      buildRequisition(REQUISITION_B, COMPANY_A, {
        number: 9,
        status: "OPEN",
        priority: "HIGH",
        responsibleId: null,
      }),
    );

    await expect(repository.listByCompany(COMPANY_A, { status: "DONE" })).resolves.toHaveLength(1);
    await expect(repository.listByCompany(COMPANY_A, { priority: "HIGH" })).resolves.toHaveLength(
      1,
    );
    await expect(
      repository.listByCompany(COMPANY_A, { responsibleId: RESPONSIBLE_ID }),
    ).resolves.toHaveLength(1);
    await expect(
      repository.listByCompany(COMPANY_A, {
        status: "DONE",
        priority: "LOW",
        responsibleId: RESPONSIBLE_ID,
      }),
    ).resolves.toHaveLength(1);
  });

  it("ordena por createdAt ascendente", async () => {
    await repository.create(
      buildRequisition(REQUISITION_A, COMPANY_A, {
        number: 8,
        createdAt: new Date("2026-08-12T12:00:00Z"),
      }),
    );
    await repository.create(
      buildRequisition(REQUISITION_B, COMPANY_A, {
        number: 9,
        createdAt: new Date("2026-08-12T10:00:00Z"),
      }),
    );

    const result = await repository.listByCompany(COMPANY_A);

    expect(result.map((item) => item.id)).toEqual([REQUISITION_B, REQUISITION_A]);
  });
});
