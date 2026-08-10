import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { loadEnv } from "../../config/env.js";
import * as schema from "./schema.js";

export function createDb(databaseUrl: string = loadEnv().DATABASE_URL) {
  const client = postgres(databaseUrl, { max: 10, prepare: false });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
