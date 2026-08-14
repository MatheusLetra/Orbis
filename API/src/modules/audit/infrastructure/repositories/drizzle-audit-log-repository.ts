import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { auditLogs } from "@/infrastructure/database/schema";
import { encodeAuditCursor } from "@/modules/audit/application/services/audit-cursor";
import { AuditLog } from "@/modules/audit/domain/entities/audit-log";
import type {
  AuditCursor,
  AuditLogFilters,
  AuditLogRepository,
} from "@/modules/audit/domain/repositories/audit-log-repository";
import { requireRow } from "@/shared/utils/require-row";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DatabaseExecutor = Database | DatabaseTransaction;

export class DrizzleAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(log: AuditLog): Promise<AuditLog> {
    const row = requireRow(
      (
        await this.db
          .insert(auditLogs)
          .values({
            id: log.props.id,
            companyId: log.props.companyId,
            actorUserId: log.props.actorUserId,
            action: log.props.action,
            entityType: log.props.entityType,
            entityId: log.props.entityId,
            metadata: log.props.metadata,
            createdAt: log.props.createdAt,
          })
          .returning()
      )[0],
    );
    return this.toEntity(row);
  }

  async list(
    companyId: string,
    filters: AuditLogFilters,
    limit: number,
    cursor: AuditCursor | null,
  ) {
    const conditions = [eq(auditLogs.companyId, companyId)];
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.actorUserId) conditions.push(eq(auditLogs.actorUserId, filters.actorUserId));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to));
    if (cursor) {
      const cursorCondition = or(
        lt(auditLogs.createdAt, cursor.createdAt),
        and(eq(auditLogs.createdAt, cursor.createdAt), lt(auditLogs.id, cursor.id)),
      );
      if (cursorCondition) conditions.push(cursorCondition);
    }
    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1);
    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => this.toEntity(row)),
      hasMore: rows.length > limit,
      nextCursor:
        rows.length > limit && last
          ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  }

  private toEntity(row: typeof auditLogs.$inferSelect) {
    return AuditLog.restore({
      id: row.id,
      companyId: row.companyId,
      actorUserId: row.actorUserId,
      action: row.action as never,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata ?? null,
      createdAt: row.createdAt,
    });
  }
}
