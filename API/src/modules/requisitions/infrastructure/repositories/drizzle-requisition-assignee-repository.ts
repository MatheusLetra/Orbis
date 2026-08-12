import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { requisitionAssignees } from "@/infrastructure/database/schema";
import type { RequisitionAssignee } from "@/modules/requisitions/domain/entities/requisition-assignee";
import type { RequisitionAssigneeRepository } from "@/modules/requisitions/domain/repositories/requisition-assignee-repository";

function toEntity(row: typeof requisitionAssignees.$inferSelect): RequisitionAssignee {
  return {
    companyId: row.companyId,
    requisitionId: row.requisitionId,
    userId: row.userId,
    createdAt: row.createdAt,
  };
}

export class DrizzleRequisitionAssigneeRepository implements RequisitionAssigneeRepository {
  constructor(private readonly db: Database) {}

  async findByRequisitionAndUser(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee | null> {
    const row = (
      await this.db
        .select()
        .from(requisitionAssignees)
        .where(
          and(
            eq(requisitionAssignees.companyId, companyId),
            eq(requisitionAssignees.requisitionId, requisitionId),
            eq(requisitionAssignees.userId, userId),
          ),
        )
    )[0];

    return row ? toEntity(row) : null;
  }

  async create(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee> {
    const rows = await this.db
      .insert(requisitionAssignees)
      .values({ companyId, requisitionId, userId })
      .onConflictDoNothing()
      .returning();

    if (rows[0]) {
      return toEntity(rows[0]);
    }

    const existing = await this.findByRequisitionAndUser(companyId, requisitionId, userId);
    if (!existing) {
      throw new Error("Vínculo de equipe não encontrado após conflito");
    }

    return existing;
  }

  async delete(companyId: string, requisitionId: string, userId: string): Promise<void> {
    await this.db
      .delete(requisitionAssignees)
      .where(
        and(
          eq(requisitionAssignees.companyId, companyId),
          eq(requisitionAssignees.requisitionId, requisitionId),
          eq(requisitionAssignees.userId, userId),
        ),
      );
  }

  async listByRequisition(
    companyId: string,
    requisitionId: string,
  ): Promise<RequisitionAssignee[]> {
    const rows = await this.db
      .select()
      .from(requisitionAssignees)
      .where(
        and(
          eq(requisitionAssignees.companyId, companyId),
          eq(requisitionAssignees.requisitionId, requisitionId),
        ),
      )
      .orderBy(asc(requisitionAssignees.createdAt), asc(requisitionAssignees.userId));

    return rows.map(toEntity);
  }
}
