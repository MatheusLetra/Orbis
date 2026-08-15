import type { Release, ReleaseMetadataData } from "@/modules/releases/domain/entities/release";
import type { ReleaseRepository } from "@/modules/releases/domain/repositories/release-repository";
import type { System } from "@/modules/systems/domain/entities/system";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import type { SystemVersion } from "@/modules/versions/domain/entities/system-version";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";

export class InMemorySystemRepository implements SystemRepository {
  private readonly items = new Map<string, System>();

  async create(system: System): Promise<System> {
    this.items.set(system.id, system);
    return system;
  }

  async findById(id: string): Promise<System | null> {
    return this.items.get(id) ?? null;
  }

  async findByNameInCompany(companyId: string, name: string): Promise<System | null> {
    for (const system of this.items.values()) {
      if (system.companyId === companyId && system.name === name) {
        return system;
      }
    }
    return null;
  }

  async listByCompany(companyId: string): Promise<System[]> {
    return [...this.items.values()]
      .filter((system) => system.companyId === companyId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async update(system: System): Promise<System> {
    this.items.set(system.id, system);
    return system;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

export class InMemorySystemVersionRepository implements SystemVersionRepository {
  private readonly items = new Map<string, SystemVersion>();

  async create(version: SystemVersion): Promise<SystemVersion> {
    this.items.set(version.id, version);
    return version;
  }

  async findById(id: string): Promise<SystemVersion | null> {
    return this.items.get(id) ?? null;
  }

  async findVersionInSystem(systemId: string, version: string): Promise<SystemVersion | null> {
    for (const item of this.items.values()) {
      if (item.systemId === systemId && item.version === version) {
        return item;
      }
    }
    return null;
  }

  async listBySystem(systemId: string): Promise<SystemVersion[]> {
    return [...this.items.values()]
      .filter((item) => item.systemId === systemId)
      .sort((a, b) => a.version.localeCompare(b.version));
  }

  async update(version: SystemVersion): Promise<SystemVersion> {
    this.items.set(version.id, version);
    return version;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

export class InMemoryReleaseRepository implements ReleaseRepository {
  private readonly items = new Map<string, Release>();

  async create(release: Release): Promise<Release> {
    this.items.set(release.id, release);
    return release;
  }

  async findById(id: string): Promise<Release | null> {
    return this.items.get(id) ?? null;
  }

  async listByCompany(companyId: string): Promise<Release[]> {
    return [...this.items.values()]
      .filter((release) => release.companyId === companyId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async update(release: Release): Promise<Release> {
    this.items.set(release.id, release);
    return release;
  }

  async updateMetadataIfDraft(
    id: string,
    companyId: string,
    metadata: ReleaseMetadataData,
  ): Promise<Release | null> {
    const release = this.items.get(id);
    if (!release || release.companyId !== companyId || release.status !== "DRAFT") return null;
    release.updateMetadata(metadata);
    return release;
  }

  async publishIfDraft(
    id: string,
    artifact: { artifactName: string; artifactLocation: string },
  ): Promise<Release | null> {
    const release = this.items.get(id);
    if (release?.status !== "DRAFT") return null;
    release.publish(artifact);
    return release;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
