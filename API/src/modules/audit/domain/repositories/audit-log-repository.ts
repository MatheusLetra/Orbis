import type { AuditAction } from "@/modules/audit/domain/audit-action";
import type { AuditLog } from "@/modules/audit/domain/entities/audit-log";

export type AuditLogFilters = {
  action?: AuditAction;
  entityType?: string;
  actorUserId?: string;
  from?: Date;
  to?: Date;
};

export type AuditCursor = {
  createdAt: Date;
  id: string;
};

export type AuditLogPage = {
  items: AuditLog[];
  hasMore: boolean;
  nextCursor: string | null;
};

export interface AuditLogRepository {
  create(log: AuditLog): Promise<AuditLog>;
  list(
    companyId: string,
    filters: AuditLogFilters,
    limit: number,
    cursor: AuditCursor | null,
  ): Promise<AuditLogPage>;
}
