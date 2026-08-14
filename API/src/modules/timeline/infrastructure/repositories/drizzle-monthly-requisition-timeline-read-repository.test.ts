import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import { companies, requisitions, users } from "@/infrastructure/database/schema";
import { DrizzleMonthlyRequisitionTimelineReadRepository } from "@/modules/timeline/infrastructure/repositories/drizzle-monthly-requisition-timeline-read-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "33333333-3333-4333-8333-333333333333";

describe.skipIf(!available)("DrizzleMonthlyRequisitionTimelineReadRepository", () => {
  let db: Database;
  let repository: DrizzleMonthlyRequisitionTimelineReadRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleMonthlyRequisitionTimelineReadRepository(db);
  });
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE requisitions, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "A" },
      { id: COMPANY_B, name: "B" },
    ]);
    await db
      .insert(users)
      .values({ id: USER_A, email: "a@example.com", name: "Ana", passwordHash: "hash" });
  });
  afterAll(async () => {
    await db?.$client.end();
  });

  it("isola tenant e aplica interseção inclusiva, pontos e undated", async () => {
    await db.insert(requisitions).values([
      {
        id: "55555555-5555-4555-8555-555555555555",
        companyId: COMPANY_A,
        number: 1,
        title: "Dentro",
        requesterId: USER_A,
        startDate: "2026-07-31",
        plannedDeliveryDate: "2026-08-01",
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        companyId: COMPANY_A,
        number: 2,
        title: "Sem data",
        requesterId: USER_A,
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        companyId: COMPANY_A,
        number: 3,
        title: "Fora",
        requesterId: USER_A,
        startDate: "2026-09-01",
        plannedDeliveryDate: "2026-09-02",
      },
      {
        id: "88888888-8888-4888-8888-888888888888",
        companyId: COMPANY_B,
        number: 1,
        title: "Outro tenant",
        requesterId: USER_A,
        startDate: "2026-08-01",
        plannedDeliveryDate: "2026-08-02",
      },
    ]);
    const result = await repository.findMonthly({
      companyId: COMPANY_A,
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });
    expect(result.map((item) => item.title)).toEqual(["Dentro", "Sem data"]);
  });

  it("inclui requisição não entregue vencida antes do período", async () => {
    await db.insert(requisitions).values({
      id: "99999999-9999-4999-8999-999999999999",
      companyId: COMPANY_A,
      number: 4,
      title: "Vencida",
      requesterId: USER_A,
      plannedDeliveryDate: "2026-07-31",
    });

    const result = await repository.findMonthly({
      companyId: COMPANY_A,
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });

    expect(result.map((item) => item.title)).toEqual(["Vencida"]);
  });
});
