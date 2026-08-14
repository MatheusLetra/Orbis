import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { loadEnv } from "@/config/env";
import * as schema from "./schema";

export function createDb(databaseUrl: string = loadEnv().DATABASE_URL) {
  const client = postgres(databaseUrl, { max: 10, prepare: false });
  return Object.assign(drizzle(client, { schema }), {
    close: () => client.end({ timeout: 5 }),
  });
}

export type Database = ReturnType<typeof createDb>;
