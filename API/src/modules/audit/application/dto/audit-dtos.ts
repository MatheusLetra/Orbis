import { z } from "zod";
import { AUDIT_ACTIONS } from "@/modules/audit/domain/audit-action";

export const auditListQuerySchema = z
  .object({
    action: z.enum(AUDIT_ACTIONS).optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
    actorUserId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({ code: "custom", path: ["from"], message: "from deve preceder to" });
    }
  });

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

export function toAuditOutput(log: {
  props: {
    id: string;
    companyId: string | null;
    actorUserId: string | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  };
}) {
  return {
    id: log.props.id,
    companyId: log.props.companyId,
    actorUserId: log.props.actorUserId,
    action: log.props.action,
    entityType: log.props.entityType,
    entityId: log.props.entityId,
    metadata: log.props.metadata,
    createdAt: log.props.createdAt.toISOString(),
  };
}
