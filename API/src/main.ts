import "dotenv/config";

import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createDb } from "./infrastructure/database/client.js";

const env = loadEnv();

async function main() {
  const database = createDb(env.DATABASE_URL);
  const app = await buildApp({ database });
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
