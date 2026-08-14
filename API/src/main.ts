import "dotenv/config";

import { buildApp } from "./app";
import { loadEnv } from "./config/env";
import { buildModules } from "./infrastructure/composition-root";
import { createDb } from "./infrastructure/database/client";

const env = loadEnv();

async function main() {
  const database = createDb(env.DATABASE_URL);
  const modules = buildModules(database, env);
  const app = await buildApp({ database, modules, config: env });
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.orbisReadiness.ready = false;
    app.log.info({ signal }, "shutdown iniciado");
    await app.close();
    await database.close();
    app.log.info("shutdown concluído");
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
