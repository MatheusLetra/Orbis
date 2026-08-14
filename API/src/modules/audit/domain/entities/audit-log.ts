import { randomUUID } from "node:crypto";
import type { AuditAction } from "@/modules/audit/domain/audit-action";

export type AuditLogProps = {
  id: string;
  companyId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export class AuditLog {
  private constructor(readonly props: AuditLogProps) {}

  static create(
    input: Omit<AuditLogProps, "id" | "createdAt"> &
      Partial<Pick<AuditLogProps, "id" | "createdAt">>,
  ): AuditLog {
    return new AuditLog({
      ...input,
      id: input.id ?? randomUUID(),
      createdAt: input.createdAt ?? new Date(),
    });
  }

  static restore(props: AuditLogProps): AuditLog {
    return new AuditLog(props);
  }
}
