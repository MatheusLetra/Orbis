import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infrastructure/database/client";
import {
  companies,
  releases,
  systems,
  systemVersions,
  users,
} from "@/infrastructure/database/schema";
import { DrizzleReleaseRepository } from "@/modules/releases/infrastructure/repositories/drizzle-release-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SYSTEM_ID = "44444444-4444-4444-8444-444444444444";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const RELEASE_ID = "66666666-6666-4666-8666-666666666666";

describe.skipIf(!available)("DrizzleReleaseRepository", () => {
  let db: Database;
  let repository: DrizzleReleaseRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleReleaseRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE releases, system_versions, systems, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "A", timezone: "UTC" },
      { id: COMPANY_B, name: "B", timezone: "UTC" },
    ]);
    await db.insert(users).values({
      id: USER_ID,
      email: "user@example.com",
      name: "User",
      passwordHash: "hash",
    });
    await db.insert(systems).values({ id: SYSTEM_ID, companyId: COMPANY_A, name: "ERP" });
    await db
      .insert(systemVersions)
      .values({ id: VERSION_ID, companyId: COMPANY_A, systemId: SYSTEM_ID, version: "1.0.0" });
    await db.insert(releases).values({
      id: RELEASE_ID,
      companyId: COMPANY_A,
      systemVersionId: VERSION_ID,
      versionLabel: "1.0.0",
      createdBy: USER_ID,
    });
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("condiciona a alteração ao tenant e ao status DRAFT", async () => {
    await expect(
      repository.updateMetadataIfDraft(RELEASE_ID, COMPANY_B, { channel: "BETA" }),
    ).resolves.toBeNull();

    const updated = await repository.updateMetadataIfDraft(RELEASE_ID, COMPANY_A, {
      versionLabel: "1.1.0",
      channel: "BETA",
    });
    expect(updated).toMatchObject({ versionLabel: "1.1.0", channel: "BETA", status: "DRAFT" });

    await db.execute(sql`UPDATE releases SET status = 'PUBLISHED' WHERE id = ${RELEASE_ID}`);
    await expect(
      repository.updateMetadataIfDraft(RELEASE_ID, COMPANY_A, { versionLabel: "2.0.0" }),
    ).resolves.toBeNull();
  });
});
