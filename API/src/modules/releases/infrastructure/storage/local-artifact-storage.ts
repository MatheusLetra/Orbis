import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep, win32 } from "node:path";

import type { ArtifactStorage } from "@/modules/releases/application/ports/artifact-storage";

export class LocalArtifactStorage implements ArtifactStorage {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = resolve(basePath);
  }

  async save(key: string, content: Buffer): Promise<void> {
    const filePath = this.resolveKey(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  async read(key: string): Promise<Buffer> {
    const filePath = this.resolveKey(key);

    try {
      return await readFile(filePath);
    } catch (error) {
      if (isFileNotFound(error)) {
        throw new Error("Artefato não encontrado");
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKey(key);
    await rm(filePath, { force: true });
  }

  private resolveKey(key: string): string {
    if (!key || key.includes("\\") || isAbsolute(key) || win32.isAbsolute(key)) {
      throw new Error("Chave de artefato inválida");
    }

    const filePath = resolve(this.basePath, key);
    const relativePath = relative(this.basePath, filePath);

    if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
      throw new Error("Chave de artefato inválida");
    }

    return filePath;
  }
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  const hasCode = error instanceof Error && "code" in error;
  return hasCode && (error as NodeJS.ErrnoException).code === "ENOENT";
}
