import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { companies, memberships, users } from "@/infrastructure/database/schema";
import type { DeveloperAvailabilityRepository } from "@/modules/capacity/application/ports/developer-availability-repository";

export class DrizzleDeveloperAvailabilityRepository implements DeveloperAvailabilityRepository {
  constructor(private readonly db: Database) {}

  async countAvailableDevelopers(companyId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(distinct ${memberships.userId})::int` })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(companies, eq(companies.id, memberships.companyId))
      .where(
        and(
          eq(memberships.companyId, companyId),
          eq(memberships.isActive, true),
          eq(users.isActive, true),
          eq(memberships.position, "DESENVOLVEDOR"),
          eq(companies.isActive, true),
        ),
      );

    return rows[0]?.count ?? 0;
  }
}
