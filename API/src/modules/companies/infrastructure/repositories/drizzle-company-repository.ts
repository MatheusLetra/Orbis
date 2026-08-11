import { and, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { companies, memberships } from "@/infrastructure/database/schema";
import type { Company } from "@/modules/companies/domain/entities/company";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import {
  toEntity,
  toInsertValues,
} from "@/modules/companies/infrastructure/mappers/company-mapper";
import { requireRow } from "@/shared/utils/require-row";

export class DrizzleCompanyRepository implements CompanyRepository {
  constructor(private readonly db: Database) {}

  async create(company: Company): Promise<Company> {
    const rows = await this.db.insert(companies).values(toInsertValues(company)).returning();

    return toEntity(requireRow(rows[0]));
  }

  async findById(id: string): Promise<Company | null> {
    const row = (await this.db.select().from(companies).where(eq(companies.id, id)))[0];

    return row ? toEntity(row) : null;
  }

  async findByUser(userId: string): Promise<Company[]> {
    const rows = await this.db
      .select()
      .from(companies)
      .innerJoin(memberships, eq(memberships.companyId, companies.id))
      .where(and(eq(memberships.userId, userId), eq(memberships.isActive, true)));

    return rows.map(({ companies: row }) => toEntity(row));
  }

  async update(company: Company): Promise<Company> {
    const rows = await this.db
      .update(companies)
      .set(toInsertValues(company))
      .where(eq(companies.id, company.id))
      .returning();

    return toEntity(requireRow(rows[0]));
  }
}
