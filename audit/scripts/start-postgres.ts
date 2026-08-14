import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { waitForPostgres } from "./wait-for-health";

const exec = promisify(execFile);

export interface TemporaryPostgres {
  containerName: string;
  databaseUrl: string;
  stop: () => Promise<void>;
}

export async function startPostgres(port: number): Promise<TemporaryPostgres> {
  const containerName = `orbis-browser-audit-${process.pid}`;
  await exec("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=postgres",
    "-e",
    "POSTGRES_PASSWORD=postgres",
    "-e",
    "POSTGRES_DB=orbis_audit",
    "-p",
    `127.0.0.1:${port}:5432`,
    "postgres:17-alpine",
  ]);
  await waitForPostgres(containerName);
  return {
    containerName,
    databaseUrl: `postgres://postgres:postgres@127.0.0.1:${port}/orbis_audit`,
    stop: async () => {
      await exec("docker", ["rm", "-f", containerName]).catch(() => undefined);
    },
  };
}
