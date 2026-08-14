import { createWriteStream, type WriteStream } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";

export interface BrowserServices {
  api: ChildProcess;
  frontend: ChildProcess;
  logs: WriteStream[];
}

export function startServices(options: {
  databaseUrl: string;
  apiPort: number;
  frontendPort: number;
  artifactDir: string;
}): BrowserServices {
  const apiLog = createWriteStream(join(options.artifactDir, "api.log"));
  const frontendLog = createWriteStream(join(options.artifactDir, "frontend.log"));
  const baseEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: options.databaseUrl,
    PORT: String(options.apiPort),
    HOST: "127.0.0.1",
    FRONTEND_ORIGIN: `http://127.0.0.1:${options.frontendPort}`,
    JWT_ACCESS_SECRET: "browser-audit-access-secret-2026-32-chars",
    JWT_REFRESH_SECRET: "browser-audit-refresh-secret-2026-32-chars",
  };
  const api = spawn("npm", ["run", "dev"], {
    cwd: join(process.cwd(), "API"),
    env: baseEnv,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const frontend = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(options.frontendPort)], {
    cwd: join(process.cwd(), "app"),
    env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${options.apiPort}` },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  api.stdout?.pipe(apiLog);
  api.stderr?.pipe(apiLog);
  frontend.stdout?.pipe(frontendLog);
  frontend.stderr?.pipe(frontendLog);
  return { api, frontend, logs: [apiLog, frontendLog] };
}

export function stopProcess(processRef: ChildProcess): void {
  if (!processRef.pid) return;
  try {
    process.kill(-processRef.pid, "SIGTERM");
  } catch {
    processRef.kill("SIGTERM");
  }
}
