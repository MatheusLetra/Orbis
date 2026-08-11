import { and, eq } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import { companies, memberships } from "../../../../infrastructure/database/schema.js";
import { requireRow } from "../../../../shared/utils/require-row.js";
import type { Company } from "../../domain/entities/company.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import { toEntity, toInsertValues } from "../mappers/company-mapper.js";

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
