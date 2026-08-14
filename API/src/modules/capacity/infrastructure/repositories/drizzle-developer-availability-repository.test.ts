import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import { companies, memberships, users } from "@/infrastructure/database/schema";
import { DrizzleDeveloperAvailabilityRepository } from "@/modules/capacity/infrastructure/repositories/drizzle-developer-availability-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const COMPANY_INACTIVE = "33333333-3333-4333-8333-333333333333";
const USER_ACTIVE_DEV = "44444444-4444-4444-8444-444444444444";
const USER_INACTIVE_DEV = "55555555-5555-4555-8555-555555555555";
const USER_ACTIVE_SUPPORT = "66666666-6666-4666-8666-666666666666";
const USER_OTHER_COMPANY = "77777777-7777-4777-8777-777777777777";
const USER_INACTIVE_COMPANY_DEV = "88888888-8888-4888-8888-888888888888";

describe.skipIf(!available)("DrizzleDeveloperAvailabilityRepository", () => {
  let db: Database;
  let repository: DrizzleDeveloperAvailabilityRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleDeveloperAvailabilityRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE memberships, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC" },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC" },
      { id: COMPANY_INACTIVE, name: "Tenant Inactive", timezone: "UTC", isActive: false },
    ]);
    await db.insert(users).values([
      {
        id: USER_ACTIVE_DEV,
        email: "active-dev@example.com",
        name: "Active Dev",
        passwordHash: "hash",
      },
      {
        id: USER_INACTIVE_DEV,
        email: "inactive-dev@example.com",
        name: "Inactive Dev",
        passwordHash: "hash",
        isActive: false,
      },
      {
        id: USER_ACTIVE_SUPPORT,
        email: "support@example.com",
        name: "Support",
        passwordHash: "hash",
      },
      {
        id: USER_OTHER_COMPANY,
        email: "other-dev@example.com",
        name: "Other Dev",
        passwordHash: "hash",
      },
      {
        id: USER_INACTIVE_COMPANY_DEV,
        email: "inactive-company-dev@example.com",
        name: "Inactive Company Dev",
        passwordHash: "hash",
      },
    ]);
    await db.insert(memberships).values([
      { companyId: COMPANY_A, userId: USER_ACTIVE_DEV, position: "DESENVOLVEDOR" },
      { companyId: COMPANY_A, userId: USER_INACTIVE_DEV, position: "DESENVOLVEDOR" },
      { companyId: COMPANY_A, userId: USER_ACTIVE_SUPPORT, position: "SUPORTE" },
      {
        companyId: COMPANY_A,
        userId: USER_OTHER_COMPANY,
        position: "DESENVOLVEDOR",
        isActive: false,
      },
      { companyId: COMPANY_B, userId: USER_OTHER_COMPANY, position: "DESENVOLVEDOR" },
      { companyId: COMPANY_INACTIVE, userId: USER_INACTIVE_COMPANY_DEV, position: "DESENVOLVEDOR" },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("conta somente desenvolvedores ativos da empresa ativa e isola os tenants", async () => {
    await expect(repository.countAvailableDevelopers(COMPANY_A)).resolves.toBe(1);
    await expect(repository.countAvailableDevelopers(COMPANY_B)).resolves.toBe(1);
    await expect(repository.countAvailableDevelopers(COMPANY_INACTIVE)).resolves.toBe(0);
    await expect(
      repository.countAvailableDevelopers("99999999-9999-4999-8999-999999999999"),
    ).resolves.toBe(0);
  });

  it("retorna zero quando todos os desenvolvedores elegíveis ficam indisponíveis", async () => {
    await db.execute(sql`UPDATE memberships SET is_active = false WHERE company_id = ${COMPANY_A}`);

    await expect(repository.countAvailableDevelopers(COMPANY_A)).resolves.toBe(0);
  });

  it("mantém a contagem sem duplicidade por usuário", async () => {
    await db.execute(
      sql`UPDATE memberships SET position = 'DESENVOLVEDOR' WHERE company_id = ${COMPANY_A} AND user_id = ${USER_OTHER_COMPANY}`,
    );

    await expect(repository.countAvailableDevelopers(COMPANY_A)).resolves.toBe(1);
  });
});
