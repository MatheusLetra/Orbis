import { and, eq } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { releases } from "@/infrastructure/database/schema";
import type { Release } from "@/modules/releases/domain/entities/release";
import type { ReleaseRepository } from "@/modules/releases/domain/repositories/release-repository";
import { toEntity, toInsertValues } from "@/modules/releases/infrastructure/mappers/release-mapper";
import { requireRow } from "@/shared/utils/require-row";

export class DrizzleReleaseRepository implements ReleaseRepository {
  constructor(private readonly db: Database) {}

  async create(release: Release): Promise<Release> {
    const rows = await this.db.insert(releases).values(toInsertValues(release)).returning();

    return toEntity(requireRow(rows[0]));
  }

  async findById(id: string): Promise<Release | null> {
    const row = (await this.db.select().from(releases).where(eq(releases.id, id)))[0];

    return row ? toEntity(row) : null;
  }

  async listByCompany(companyId: string): Promise<Release[]> {
    const rows = await this.db
      .select()
      .from(releases)
      .where(eq(releases.companyId, companyId))
      .orderBy(releases.createdAt);

    return rows.map(toEntity);
  }

  async update(release: Release): Promise<Release> {
    const rows = await this.db
      .update(releases)
      .set(toInsertValues(release))
      .where(eq(releases.id, release.id))
      .returning();

    return toEntity(requireRow(rows[0]));
  }

  async publishIfDraft(
    id: string,
    artifact: { artifactName: string; artifactLocation: string },
  ): Promise<Release | null> {
    const rows = await this.db
      .update(releases)
      .set({
        artifactName: artifact.artifactName,
        artifactLocation: artifact.artifactLocation,
        status: "PUBLISHED",
        publishedAt: new Date(),
      })
      .where(and(eq(releases.id, id), eq(releases.status, "DRAFT")))
      .returning();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(releases).where(eq(releases.id, id));
  }
}
