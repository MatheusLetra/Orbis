import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infrastructure/database/client";
import { companies, requisitions, users } from "@/infrastructure/database/schema";
import { DrizzleYearlyRequisitionTimelineReadRepository } from "@/modules/timeline/infrastructure/repositories/drizzle-yearly-requisition-timeline-read-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "33333333-3333-4333-8333-333333333333";

describe.skipIf(!available)("DrizzleYearlyRequisitionTimelineReadRepository", () => {
  let db: Database;
  let repository: DrizzleYearlyRequisitionTimelineReadRepository;
  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleYearlyRequisitionTimelineReadRepository(db);
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
  it("aplica tenant, interseção anual e exclui datas invertidas da leitura datada", async () => {
    await db.insert(requisitions).values([
      {
        id: "55555555-5555-4555-8555-555555555555",
        companyId: COMPANY_A,
        number: 1,
        title: "Dentro",
        requesterId: USER_A,
        startDate: "2026-01-01",
        plannedDeliveryDate: "2026-12-31",
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        companyId: COMPANY_A,
        number: 2,
        title: "Invertida",
        requesterId: USER_A,
        startDate: "2026-06-20",
        plannedDeliveryDate: "2026-06-10",
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        companyId: COMPANY_B,
        number: 1,
        title: "Outro tenant",
        requesterId: USER_A,
        startDate: "2026-01-01",
        plannedDeliveryDate: "2026-01-02",
      },
    ]);
    const result = await repository.findYearly({
      companyId: COMPANY_A,
      yearStart: "2026-01-01",
      yearEnd: "2026-12-31",
    });
    expect(result.map((item) => item.title)).toEqual(["Invertida", "Dentro"]);
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Outro tenant" })]),
    );
  });
});
