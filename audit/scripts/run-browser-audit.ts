import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { startPostgres } from "./start-postgres";
import { cleanupDirectory, cleanupServices } from "./cleanup-services";
import { startServices } from "./start-services";
import { waitForHttp } from "./wait-for-health";

const exec = promisify(execFile);
const suite = process.argv[2] ?? "all";
const headed = process.argv.includes("--headed");
const root = process.cwd();
const artifactDir = join(root, "artifacts", "browser-audit", `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID()}`);
const runtimeDir = join(root, ".audit-runtime", randomUUID());
let services: ReturnType<typeof startServices> | undefined;
let database: Awaited<ReturnType<typeof startPostgres>> | undefined;
let browserStarted = false;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Porta inválida"));
      server.close(() => resolve(address.port));
    });
  });
}

async function runLogged(
  command: string,
  args: string[],
  options: Parameters<typeof exec>[2],
  logPath: string,
): Promise<void> {
  try {
    const result = await exec(command, args, options);
    await writeFile(logPath, `${result.stdout}${result.stderr}`);
  } catch (error) {
    const details = error as { stdout?: string; stderr?: string };
    await writeFile(logPath, `${details.stdout ?? ""}${details.stderr ?? ""}`);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log(`Browser audit starting: ${suite} (${artifactDir})`);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(runtimeDir, { recursive: true });
  const dbPort = await freePort();
  const apiPort = await freePort();
  const frontendPort = await freePort();
  database = await startPostgres(dbPort);
  await runLogged("npm", ["run", "db:migrate"], {
    cwd: join(root, "API"),
    env: { ...process.env, DATABASE_URL: database.databaseUrl },
  }, join(artifactDir, "migrations.log"));
  await runLogged("npx", ["tsx", "audit/scripts/seed-browser-fixtures.ts"], {
    cwd: root,
    env: { ...process.env, AUDIT_DATABASE_URL: database.databaseUrl },
  }, join(artifactDir, "seed.log"));
  services = startServices({ databaseUrl: database.databaseUrl, apiPort, frontendPort, artifactDir });
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  await waitForHttp(`${apiUrl}/health`);
  await waitForHttp(frontendUrl);
  await writeFile(join(runtimeDir, "runtime.json"), JSON.stringify({ apiUrl, frontendUrl, suite }, null, 2));
  browserStarted = true;
  const grep = suite === "all" ? undefined : `@${suite}`;
  await exec("npx", ["playwright", "test", ...(grep ? ["--grep", grep] : [])], {
    cwd: root,
    env: {
      ...process.env,
      AUDIT_ARTIFACT_DIR: artifactDir,
      AUDIT_FRONTEND_URL: frontendUrl,
      AUDIT_API_URL: apiUrl,
      AUDIT_HEADED: headed ? "1" : "0",
    },
  });
  console.log(`Browser audit completed: ${suite}`);
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    await writeFile(
      join(artifactDir, "failure.json"),
      JSON.stringify(
        {
          classification: browserStarted ? "functional-failure" : "environment-failure",
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await cleanupServices(services);
    await database?.stop();
    await cleanupDirectory(runtimeDir);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
