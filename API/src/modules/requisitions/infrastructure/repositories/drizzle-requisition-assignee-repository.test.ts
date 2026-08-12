import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import {
  companies,
  requisitionAssignees,
  requisitions,
  users,
} from "@/infrastructure/database/schema";
import { DrizzleRequisitionAssigneeRepository } from "@/modules/requisitions/infrastructure/repositories/drizzle-requisition-assignee-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const REQUISITION_A = "33333333-3333-4333-8333-333333333333";
const USER_A = "44444444-4444-4444-8444-444444444444";
const USER_B = "55555555-5555-4555-8555-555555555555";

describe.skipIf(!available)("DrizzleRequisitionAssigneeRepository", () => {
  let db: Database;
  let repository: DrizzleRequisitionAssigneeRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleRequisitionAssigneeRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE requisition_assignees, requisitions, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC" },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC" },
    ]);
    await db.insert(users).values([
      {
        id: USER_A,
        email: "assignee-a@example.com",
        name: "Assignee A",
        passwordHash: "hash-a",
      },
      {
        id: USER_B,
        email: "assignee-b@example.com",
        name: "Assignee B",
        passwordHash: "hash-b",
      },
    ]);
    await db.insert(requisitions).values({
      id: REQUISITION_A,
      companyId: COMPANY_A,
      number: 1,
      title: "Requisição A",
      requesterId: USER_A,
    });
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("cria e busca um vínculo com todos os filtros", async () => {
    const created = await repository.create(COMPANY_A, REQUISITION_A, USER_A);

    await expect(
      repository.findByRequisitionAndUser(COMPANY_A, REQUISITION_A, USER_A),
    ).resolves.toEqual(created);
  });

  it("retorna null quando o vínculo não existe", async () => {
    await expect(
      repository.findByRequisitionAndUser(COMPANY_A, REQUISITION_A, USER_A),
    ).resolves.toBeNull();
  });

  it("é idempotente ao criar o mesmo vínculo", async () => {
    const first = await repository.create(COMPANY_A, REQUISITION_A, USER_A);
    const second = await repository.create(COMPANY_A, REQUISITION_A, USER_A);

    expect(second).toEqual(first);
    await expect(
      db.execute(
        sql`select count(*)::int as count from requisition_assignees where company_id = ${COMPANY_A}`,
      ),
    ).resolves.toEqual([{ count: 1 }]);
  });

  it("permite criação concorrente idempotente", async () => {
    const created = await Promise.all(
      Array.from({ length: 4 }, () => repository.create(COMPANY_A, REQUISITION_A, USER_A)),
    );

    expect(new Set(created.map((item) => item.userId))).toEqual(new Set([USER_A]));
    await expect(
      db.execute(
        sql`select count(*)::int as count from requisition_assignees where company_id = ${COMPANY_A}`,
      ),
    ).resolves.toEqual([{ count: 1 }]);
  });

  it("remove o vínculo pelos três filtros", async () => {
    await repository.create(COMPANY_A, REQUISITION_A, USER_A);

    await repository.delete(COMPANY_A, REQUISITION_A, USER_A);

    await expect(
      repository.findByRequisitionAndUser(COMPANY_A, REQUISITION_A, USER_A),
    ).resolves.toBeNull();
  });

  it("lista somente o tenant e a requisição informados", async () => {
    await repository.create(COMPANY_A, REQUISITION_A, USER_A);
    await db.insert(requisitions).values({
      id: "66666666-6666-4666-8666-666666666666",
      companyId: COMPANY_B,
      number: 1,
      title: "Requisição B",
      requesterId: USER_B,
    });
    await db.insert(requisitionAssignees).values({
      companyId: COMPANY_B,
      requisitionId: "66666666-6666-4666-8666-666666666666",
      userId: USER_B,
    });

    const result = await repository.listByRequisition(COMPANY_A, REQUISITION_A);

    expect(result).toHaveLength(1);
    expect(result[0]?.companyId).toBe(COMPANY_A);
  });

  it("ordena por createdAt e userId", async () => {
    await repository.create(COMPANY_A, REQUISITION_A, USER_B);
    await repository.create(COMPANY_A, REQUISITION_A, USER_A);
    await db.execute(
      sql`update requisition_assignees set created_at = '2026-01-01T00:00:00Z' where user_id = ${USER_A}`,
    );
    await db.execute(
      sql`update requisition_assignees set created_at = '2026-01-01T00:00:00Z' where user_id = ${USER_B}`,
    );

    const result = await repository.listByRequisition(COMPANY_A, REQUISITION_A);

    expect(result.map((item) => item.userId)).toEqual([USER_A, USER_B]);
  });

  it("mapeia somente os campos de RequisitionAssignee", async () => {
    const result = await repository.create(COMPANY_A, REQUISITION_A, USER_A);

    expect(result).toEqual({
      companyId: COMPANY_A,
      requisitionId: REQUISITION_A,
      userId: USER_A,
      createdAt: expect.any(Date),
    });
    expect(result).not.toHaveProperty("id");
  });

  it("não cruza vínculos entre tenants", async () => {
    await repository.create(COMPANY_A, REQUISITION_A, USER_A);

    await expect(
      repository.findByRequisitionAndUser(COMPANY_B, REQUISITION_A, USER_A),
    ).resolves.toBeNull();
  });
});
