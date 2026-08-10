import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();

async function main() {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
