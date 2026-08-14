import type { AuditAction } from "@/modules/audit/domain/audit-action";

export type AuditRecordInput = {
  companyId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
};

export interface AuditRecorder {
  record(input: AuditRecordInput): Promise<void>;
}

export const NOOP_AUDIT_RECORDER: AuditRecorder = { async record() {} };
