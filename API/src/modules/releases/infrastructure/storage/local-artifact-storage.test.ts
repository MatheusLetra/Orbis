import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalArtifactStorage } from "./local-artifact-storage";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createStorage() {
  const parent = await mkdtemp(join(tmpdir(), "orbis-artifact-storage-"));
  const basePath = join(parent, "storage");
  temporaryDirectories.push(parent);
  return { basePath, storage: new LocalArtifactStorage(basePath) };
}

describe("LocalArtifactStorage", () => {
  it("salva e lê bytes em uma chave aninhada, criando os diretórios", async () => {
    const { basePath, storage } = await createStorage();
    const content = Buffer.from([0, 1, 2, 127, 128, 255]);

    await storage.save("company/release/app.bin", content);

    expect(await storage.read("company/release/app.bin")).toEqual(content);
    expect(await readFile(join(basePath, "company/release/app.bin"))).toEqual(content);
  });

  it("sobrescreve o conteúdo da mesma chave", async () => {
    const { storage } = await createStorage();

    await storage.save("company/release/app.bin", Buffer.from("old"));
    await storage.save("company/release/app.bin", Buffer.from("new"));

    expect(await storage.read("company/release/app.bin")).toEqual(Buffer.from("new"));
  });

  it("remove um arquivo e mantém delete idempotente", async () => {
    const { basePath, storage } = await createStorage();
    const key = "company/release/app.bin";

    await storage.save(key, Buffer.from("content"));
    await storage.delete(key);
    await storage.delete(key);

    await expect(stat(resolve(basePath, key))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("usa a semântica de artefato não encontrado no read", async () => {
    const { storage } = await createStorage();

    await expect(storage.read("missing.bin")).rejects.toThrow("Artefato não encontrado");
  });

  it.each([
    "../outside.bin",
    "company/../../outside.bin",
    "company\\..\\outside.bin",
    resolve("/tmp", "outside.bin"),
  ])("rejeita a chave insegura %s em save, read e delete", async (key) => {
    const { basePath, storage } = await createStorage();
    const outsidePath = join(basePath, "..", "outside.bin");

    await expect(storage.save(key, Buffer.from("blocked"))).rejects.toThrow(
      "Chave de artefato inválida",
    );
    await expect(storage.read(key)).rejects.toThrow("Chave de artefato inválida");
    await expect(storage.delete(key)).rejects.toThrow("Chave de artefato inválida");
    await expect(stat(outsidePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("não confunde um diretório sibling com conteúdo do diretório-base", async () => {
    const { basePath, storage } = await createStorage();
    const siblingPath = `${basePath}-other/outside.bin`;
    await mkdir(resolve(siblingPath, ".."), { recursive: true });
    await writeFile(siblingPath, Buffer.from("protected"));

    await expect(storage.read("../storage-other/outside.bin")).rejects.toThrow(
      "Chave de artefato inválida",
    );
    expect(await readFile(siblingPath)).toEqual(Buffer.from("protected"));
  });
});
