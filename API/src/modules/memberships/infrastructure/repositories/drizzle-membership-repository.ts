import { and, eq } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { memberships } from "@/infrastructure/database/schema";
import type { Membership } from "@/modules/memberships/domain/entities/membership";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import {
  toEntity,
  toInsertValues,
} from "@/modules/memberships/infrastructure/mappers/membership-mapper";
import { requireRow } from "@/shared/utils/require-row";

export class DrizzleMembershipRepository implements MembershipRepository {
  constructor(private readonly db: Database) {}

  async create(membership: Membership): Promise<Membership> {
    const rows = await this.db.insert(memberships).values(toInsertValues(membership)).returning();

    return toEntity(requireRow(rows[0]));
  }

  async findById(id: string): Promise<Membership | null> {
    const row = (await this.db.select().from(memberships).where(eq(memberships.id, id)))[0];

    return row ? toEntity(row) : null;
  }

  async findByUserAndCompany(userId: string, companyId: string): Promise<Membership | null> {
    const row = (
      await this.db
        .select()
        .from(memberships)
        .where(and(eq(memberships.userId, userId), eq(memberships.companyId, companyId)))
    )[0];

    return row ? toEntity(row) : null;
  }

  async listByUser(userId: string): Promise<Membership[]> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .orderBy(memberships.createdAt);

    return rows.map(toEntity);
  }

  async listByCompany(companyId: string): Promise<Membership[]> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(eq(memberships.companyId, companyId))
      .orderBy(memberships.createdAt);

    return rows.map(toEntity);
  }

  async update(membership: Membership): Promise<Membership> {
    const rows = await this.db
      .update(memberships)
      .set(toInsertValues(membership))
      .where(eq(memberships.id, membership.id))
      .returning();

    return toEntity(requireRow(rows[0]));
  }
}
