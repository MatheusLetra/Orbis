import { sql } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { requisitionNumberCounters } from "@/infrastructure/database/schema";
import type { RequisitionNumberGenerator } from "@/modules/requisitions/application/ports/requisition-number-generator";
import { requireRow } from "@/shared/utils/require-row";

export class DrizzleRequisitionNumberGenerator implements RequisitionNumberGenerator {
  constructor(private readonly db: Database) {}

  async next(companyId: string): Promise<number> {
    const rows = await this.db
      .insert(requisitionNumberCounters)
      .values({ companyId, lastNumber: 1 })
      .onConflictDoUpdate({
        target: requisitionNumberCounters.companyId,
        set: {
          lastNumber: sql`${requisitionNumberCounters.lastNumber} + 1`,
        },
      })
      .returning({ lastNumber: requisitionNumberCounters.lastNumber });

    return requireRow(rows[0], "Não foi possível reservar número de requisição").lastNumber;
  }
}
