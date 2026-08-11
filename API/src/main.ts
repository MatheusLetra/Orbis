import "dotenv/config";

import { buildApp } from "./app";
import { loadEnv } from "./config/env";
import { buildModules } from "./infrastructure/composition-root";
import { createDb } from "./infrastructure/database/client";

const env = loadEnv();

async function main() {
  const database = createDb(env.DATABASE_URL);
  const modules = buildModules(database);
  const app = await buildApp({ database, modules, config: env });
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
