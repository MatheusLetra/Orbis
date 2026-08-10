import { sql } from "drizzle-orm";

import type { Database } from "./client.js";

export interface DatabaseHealth {
  status: "ok" | "unavailable";
  latencyMs?: number;
}

export async function checkDatabaseHealth(database: Database): Promise<DatabaseHealth> {
  const startedAt = performance.now();
  try {
    await database.execute(sql`select 1`);
    return { status: "ok", latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { status: "unavailable" };
  }
}
