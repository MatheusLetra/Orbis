import { and, eq } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { systems } from "@/infrastructure/database/schema";
import type { System } from "@/modules/systems/domain/entities/system";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import { toEntity, toInsertValues } from "@/modules/systems/infrastructure/mappers/system-mapper";
import { requireRow } from "@/shared/utils/require-row";

export class DrizzleSystemRepository implements SystemRepository {
  constructor(private readonly db: Database) {}

  async create(system: System): Promise<System> {
    const rows = await this.db.insert(systems).values(toInsertValues(system)).returning();

    return toEntity(requireRow(rows[0]));
  }

  async findById(id: string): Promise<System | null> {
    const row = (await this.db.select().from(systems).where(eq(systems.id, id)))[0];

    return row ? toEntity(row) : null;
  }

  async findByNameInCompany(companyId: string, name: string): Promise<System | null> {
    const row = (
      await this.db
        .select()
        .from(systems)
        .where(and(eq(systems.companyId, companyId), eq(systems.name, name)))
    )[0];

    return row ? toEntity(row) : null;
  }

  async listByCompany(companyId: string): Promise<System[]> {
    const rows = await this.db
      .select()
      .from(systems)
      .where(eq(systems.companyId, companyId))
      .orderBy(systems.name);

    return rows.map(toEntity);
  }

  async update(system: System): Promise<System> {
    const rows = await this.db
      .update(systems)
      .set(toInsertValues(system))
      .where(eq(systems.id, system.id))
      .returning();

    return toEntity(requireRow(rows[0]));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(systems).where(eq(systems.id, id));
  }
}
