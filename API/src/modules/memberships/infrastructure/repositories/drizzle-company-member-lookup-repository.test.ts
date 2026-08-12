import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import { companies, memberships, users } from "@/infrastructure/database/schema";
import { DrizzleCompanyMemberLookupRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-company-member-lookup-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "33333333-3333-4333-8333-333333333333";
const USER_B = "44444444-4444-4444-8444-444444444444";
const MEMBERSHIP_A = "55555555-5555-4555-8555-555555555555";
const MEMBERSHIP_B = "66666666-6666-4666-8666-666666666666";

describe.skipIf(!available)("DrizzleCompanyMemberLookupRepository", () => {
  let db: Database;
  let repository: DrizzleCompanyMemberLookupRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleCompanyMemberLookupRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE memberships, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC" },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC" },
    ]);
    await db.insert(users).values([
      { id: USER_A, email: "ana@example.com", name: "Ana Silva", passwordHash: "hash" },
      { id: USER_B, email: "bruno@example.com", name: "Bruno Lima", passwordHash: "hash" },
    ]);
    await db.insert(memberships).values([
      { id: MEMBERSHIP_A, companyId: COMPANY_A, userId: USER_A, position: "SUPORTE" },
      { id: MEMBERSHIP_B, companyId: COMPANY_B, userId: USER_B, position: "SUPORTE" },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("lista membros ativos do tenant e pesquisa literalmente", async () => {
    await expect(repository.listActiveByCompany(COMPANY_A, "  ana ")).resolves.toEqual([
      { userId: USER_A, name: "Ana Silva" },
    ]);

    await db.execute(sql`UPDATE memberships SET is_active = false WHERE id = ${MEMBERSHIP_A}`);
    await expect(repository.listActiveByCompany(COMPANY_A)).resolves.toEqual([]);
    await expect(repository.listActiveByCompany(COMPANY_B)).resolves.toEqual([
      { userId: USER_B, name: "Bruno Lima" },
    ]);
  });
});
