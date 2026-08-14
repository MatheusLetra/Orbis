import { eq } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { companies } from "@/infrastructure/database/schema";
import type { CompanyCapacitySettingsRepository } from "@/modules/capacity/application/ports/company-capacity-settings-repository";

export class DrizzleCompanyCapacitySettingsRepository implements CompanyCapacitySettingsRepository {
  constructor(private readonly db: Database) {}

  async getDailyHoursPerDeveloper(companyId: string): Promise<number | null> {
    const rows = await this.db
      .select({ dailyHoursPerDeveloper: companies.dailyHoursPerDeveloper })
      .from(companies)
      .where(eq(companies.id, companyId));

    return rows[0]?.dailyHoursPerDeveloper ?? null;
  }

  async setDailyHoursPerDeveloper(
    companyId: string,
    dailyHoursPerDeveloper: number,
  ): Promise<number> {
    const rows = await this.db
      .update(companies)
      .set({ dailyHoursPerDeveloper })
      .where(eq(companies.id, companyId))
      .returning({ dailyHoursPerDeveloper: companies.dailyHoursPerDeveloper });

    const value = rows[0]?.dailyHoursPerDeveloper;
    if (value === undefined || value === null) {
      throw new Error("Configuração de capacidade não persistida");
    }

    return value;
  }
}
