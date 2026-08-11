import { describe, expect, it } from "vitest";
import { Release } from "@/modules/releases/domain/entities/release";

describe("Release", () => {
  it("cria uma release em rascunho com channel padrão STABLE", () => {
    const release = Release.create({
      companyId: "company-1",
      systemVersionId: "version-1",
      versionLabel: "1.0.0",
      createdBy: "user-1",
    });

    expect(release.companyId).toBe("company-1");
    expect(release.systemVersionId).toBe("version-1");
    expect(release.versionLabel).toBe("1.0.0");
    expect(release.channel).toBe("STABLE");
    expect(release.status).toBe("DRAFT");
    expect(release.artifactName).toBeNull();
    expect(release.storageKey).toBeNull();
    expect(release.checksum).toBeNull();
    expect(release.sizeBytes).toBeNull();
    expect(release.publishedAt).toBeNull();
    expect(release.createdBy).toBe("user-1");
  });

  it("aceita channel BETA", () => {
    const release = Release.create({
      companyId: "company-1",
      systemVersionId: "version-1",
      versionLabel: "1.1.0-beta",
      channel: "BETA",
      createdBy: "user-1",
    });

    expect(release.channel).toBe("BETA");
  });

  it("restaura a partir de props", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const publishedAt = new Date("2026-01-02T00:00:00Z");
    const release = Release.restore({
      id: "release-1",
      companyId: "company-1",
      systemVersionId: "version-1",
      versionLabel: "1.0.0",
      channel: "STABLE",
      status: "PUBLISHED",
      artifactName: "app.exe",
      storageKey: "company-1/release-1/app.exe",
      checksum: "abc123",
      sizeBytes: 42,
      publishedAt,
      createdBy: "user-1",
      createdAt: now,
    });

    expect(release.id).toBe("release-1");
    expect(release.status).toBe("PUBLISHED");
    expect(release.artifactName).toBe("app.exe");
    expect(release.publishedAt).toEqual(publishedAt);
  });

  it("publish preenche os metadados do artefato e marca como publicada", () => {
    const release = Release.create({
      companyId: "company-1",
      systemVersionId: "version-1",
      versionLabel: "1.0.0",
      createdBy: "user-1",
    });

    release.publish({
      artifactName: "app.exe",
      storageKey: "company-1/release-id/app.exe",
      checksum: "deadbeef",
      sizeBytes: 1024,
    });

    expect(release.status).toBe("PUBLISHED");
    expect(release.artifactName).toBe("app.exe");
    expect(release.storageKey).toBe("company-1/release-id/app.exe");
    expect(release.checksum).toBe("deadbeef");
    expect(release.sizeBytes).toBe(1024);
    expect(release.publishedAt).toBeInstanceOf(Date);
  });
});
