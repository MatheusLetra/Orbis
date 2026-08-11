import { and, eq } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { systemVersions } from "@/infrastructure/database/schema";
import type { SystemVersion } from "@/modules/versions/domain/entities/system-version";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import {
  toEntity,
  toInsertValues,
} from "@/modules/versions/infrastructure/mappers/system-version-mapper";
import { requireRow } from "@/shared/utils/require-row";

export class DrizzleSystemVersionRepository implements SystemVersionRepository {
  constructor(private readonly db: Database) {}

  async create(version: SystemVersion): Promise<SystemVersion> {
    const rows = await this.db.insert(systemVersions).values(toInsertValues(version)).returning();

    return toEntity(requireRow(rows[0]));
  }

  async findById(id: string): Promise<SystemVersion | null> {
    const row = (await this.db.select().from(systemVersions).where(eq(systemVersions.id, id)))[0];

    return row ? toEntity(row) : null;
  }

  async findVersionInSystem(systemId: string, version: string): Promise<SystemVersion | null> {
    const row = (
      await this.db
        .select()
        .from(systemVersions)
        .where(and(eq(systemVersions.systemId, systemId), eq(systemVersions.version, version)))
    )[0];

    return row ? toEntity(row) : null;
  }

  async listBySystem(systemId: string): Promise<SystemVersion[]> {
    const rows = await this.db
      .select()
      .from(systemVersions)
      .where(eq(systemVersions.systemId, systemId))
      .orderBy(systemVersions.version);

    return rows.map(toEntity);
  }

  async update(version: SystemVersion): Promise<SystemVersion> {
    const rows = await this.db
      .update(systemVersions)
      .set(toInsertValues(version))
      .where(eq(systemVersions.id, version.id))
      .returning();

    return toEntity(requireRow(rows[0]));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(systemVersions).where(eq(systemVersions.id, id));
  }
}
