import { setTimeout as delay } from "node:timers/promises";

export async function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "sem resposta";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Healthcheck não respondeu: ${url} (${lastError})`);
}

export async function waitForPostgres(containerName: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await Bunless.exec("docker", ["exec", containerName, "pg_isready", "-U", "postgres"]);
    if (result.code === 0) return;
    await delay(250);
  }
  throw new Error(`PostgreSQL não ficou pronto: ${containerName}`);
}

const Bunless = {
  async exec(command: string, args: string[]) {
    const { execFile } = await import("node:child_process");
    return new Promise<{ code: number }>((resolve) => {
      execFile(command, args, (error) => resolve({ code: error ? 1 : 0 }));
    });
  },
};
