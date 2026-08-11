import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import { companies } from "@/infrastructure/database/schema";
import { DrizzleRequisitionNumberGenerator } from "@/modules/requisitions/infrastructure/numbering/drizzle-requisition-number-generator";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();

describe.skipIf(!available)("DrizzleRequisitionNumberGenerator", () => {
  let db: Database;
  let generator: DrizzleRequisitionNumberGenerator;

  beforeAll(async () => {
    db = await createTestDatabase();
    generator = new DrizzleRequisitionNumberGenerator(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE companies CASCADE;`);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  async function createCompany(name: string) {
    const rows = await db
      .insert(companies)
      .values({ name, timezone: "America/Sao_Paulo" })
      .returning({ id: companies.id });

    return rows[0].id;
  }

  it("retorna 1 na primeira chamada e incrementa nas seguintes", async () => {
    const companyId = await createCompany("Orbis");

    await expect(generator.next(companyId)).resolves.toBe(1);
    await expect(generator.next(companyId)).resolves.toBe(2);
    await expect(generator.next(companyId)).resolves.toBe(3);
  });

  it("mantém contadores independentes por empresa", async () => {
    const companyA = await createCompany("Tenant A");
    const companyB = await createCompany("Tenant B");

    await expect(generator.next(companyA)).resolves.toBe(1);
    await expect(generator.next(companyB)).resolves.toBe(1);
    await expect(generator.next(companyA)).resolves.toBe(2);
  });

  it("retorna números únicos sob concorrência na mesma empresa", async () => {
    const companyId = await createCompany("Orbis");
    const numbers = await Promise.all(Array.from({ length: 20 }, () => generator.next(companyId)));

    expect(new Set(numbers).size).toBe(20);
    expect(numbers.sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("remove o contador quando a empresa é excluída", async () => {
    const companyId = await createCompany("Orbis");

    await generator.next(companyId);
    await db.delete(companies).where(sql`${companies.id} = ${companyId}`);

    await expect(
      db.execute(sql`
        SELECT 1
        FROM requisition_number_counters
        WHERE company_id = ${companyId}
      `),
    ).resolves.toHaveLength(0);
  });

  it("não reserva número quando a empresa não existe", async () => {
    const missingCompanyId = "00000000-0000-4000-8000-000000000000";

    await expect(generator.next(missingCompanyId)).rejects.toBeTruthy();
  });
});
