import { rm } from "node:fs/promises";
import type { BrowserServices } from "./start-services";
import { stopProcess } from "./start-services";

export async function cleanupServices(services: BrowserServices | undefined): Promise<void> {
  if (!services) return;
  stopProcess(services.api);
  stopProcess(services.frontend);
  for (const log of services.logs) await new Promise<void>((resolve) => log.end(resolve));
}

export async function cleanupDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
