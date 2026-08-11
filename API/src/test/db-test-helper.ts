import { resolve } from "node:path";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDb, type Database } from "../infrastructure/database/client.js";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/orbis_test";

export async function isTestDatabaseAvailable(): Promise<boolean> {
  let db: Database | null = null;
  try {
    db = createDb(TEST_DATABASE_URL);
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  } finally {
    await db?.$client.end();
  }
}

export async function createTestDatabase(): Promise<Database> {
  const db = createDb(TEST_DATABASE_URL);
  await migrate(db, {
    migrationsFolder: resolve(process.cwd(), "src/infrastructure/database/migrations"),
  });
  return db;
}

export async function resetIdentityTables(db: Database): Promise<void> {
  await db.execute(sql`TRUNCATE companies, users, memberships CASCADE;`);
}
