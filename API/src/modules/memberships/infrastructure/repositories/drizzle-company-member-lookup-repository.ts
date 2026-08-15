import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { memberships, users } from "@/infrastructure/database/schema";
import type {
  CompanyMemberLookup,
  CompanyMemberLookupRepository,
  CompanyMembershipLookup,
} from "@/modules/memberships/domain/repositories/company-member-lookup-repository";

export class DrizzleCompanyMemberLookupRepository implements CompanyMemberLookupRepository {
  constructor(private readonly db: Database) {}

  async listActiveByCompany(companyId: string, search?: string): Promise<CompanyMemberLookup[]> {
    const conditions = [eq(memberships.companyId, companyId), eq(memberships.isActive, true)];
    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      conditions.push(
        sql`${users.name} ILIKE ${`%${escapeLikePattern(normalizedSearch)}%`} ESCAPE '\\'`,
      );
    }

    const rows = await this.db
      .select({ userId: users.id, name: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(...conditions))
      .orderBy(asc(users.name), asc(users.id));

    return rows;
  }

  async listMembershipsByCompany(companyId: string): Promise<CompanyMembershipLookup[]> {
    return this.db
      .select({
        id: memberships.id,
        companyId: memberships.companyId,
        userId: users.id,
        name: users.name,
        email: users.email,
        position: memberships.position,
        permissions: memberships.permissions,
        isActive: memberships.isActive,
        userIsActive: users.isActive,
        createdAt: memberships.createdAt,
        updatedAt: memberships.updatedAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.companyId, companyId))
      .orderBy(asc(users.name), asc(memberships.id))
      .then((rows) => rows.map((row) => ({ ...row, position: row.position ?? "" })));
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
