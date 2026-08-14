import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import { companies } from "@/infrastructure/database/schema";
import { DrizzleCompanyCapacitySettingsRepository } from "@/modules/capacity/infrastructure/repositories/drizzle-company-capacity-settings-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";

describe.skipIf(!available)("DrizzleCompanyCapacitySettingsRepository", () => {
  let db: Database;
  let repository: DrizzleCompanyCapacitySettingsRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleCompanyCapacitySettingsRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE companies, users, memberships CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC", settings: { preserved: true } },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC" },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("preserva null e grava valores fracionários com duas casas", async () => {
    await expect(repository.getDailyHoursPerDeveloper(COMPANY_A)).resolves.toBeNull();
    await expect(repository.setDailyHoursPerDeveloper(COMPANY_A, 0.01)).resolves.toBe(0.01);
    await expect(repository.getDailyHoursPerDeveloper(COMPANY_A)).resolves.toBe(0.01);
    await expect(repository.setDailyHoursPerDeveloper(COMPANY_A, 7.5)).resolves.toBe(7.5);
    await expect(repository.getDailyHoursPerDeveloper(COMPANY_A)).resolves.toBe(7.5);
  });

  it("isola empresas e preserva outras colunas", async () => {
    await repository.setDailyHoursPerDeveloper(COMPANY_A, 8);

    await expect(repository.getDailyHoursPerDeveloper(COMPANY_B)).resolves.toBeNull();
    const rows = await db
      .select({ name: companies.name, timezone: companies.timezone, settings: companies.settings })
      .from(companies)
      .where(sql`${companies.id} = ${COMPANY_A}`);

    expect(rows[0]).toEqual({ name: "Tenant A", timezone: "UTC", settings: { preserved: true } });
  });

  it("mantém a coluna nullable para empresas existentes sem configuração", async () => {
    const rows = await db
      .select({ dailyHoursPerDeveloper: companies.dailyHoursPerDeveloper })
      .from(companies);

    expect(rows).toEqual([{ dailyHoursPerDeveloper: null }, { dailyHoursPerDeveloper: null }]);
  });
});
