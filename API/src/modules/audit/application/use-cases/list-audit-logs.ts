import {
  type AuditListQuery,
  auditListQuerySchema,
  toAuditOutput,
} from "@/modules/audit/application/dto/audit-dtos";
import { decodeAuditCursor } from "@/modules/audit/application/services/audit-cursor";
import type {
  AuditLogFilters,
  AuditLogRepository,
} from "@/modules/audit/domain/repositories/audit-log-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface ListAuditLogsCommand {
  actor: AuthenticatedUser;
  companyId: string;
  query: AuditListQuery;
}

export class ListAuditLogs
  implements
    UseCase<
      ListAuditLogsCommand,
      {
        companyId: string;
        items: ReturnType<typeof toAuditOutput>[];
        hasMore: boolean;
        nextCursor: string | null;
      }
    >
{
  constructor(
    private readonly repository: AuditLogRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListAuditLogsCommand) {
    this.authorization.assertCompanyContext(input.actor, input.companyId);
    this.authorization.assertPermission(input.actor, "audit.read");
    await this.accessService.assertAccess(input.actor.userId, input.companyId);

    const parsed = auditListQuerySchema.safeParse(input.query);
    if (!parsed.success) {
      throw new ValidationError("Filtros de auditoria inválidos", {
        details: { issues: parsed.error.issues },
      });
    }
    const cursor = parsed.data.cursor ? decodeAuditCursor(parsed.data.cursor) : null;
    const filters: AuditLogFilters = {
      action: parsed.data.action,
      entityType: parsed.data.entityType,
      actorUserId: parsed.data.actorUserId,
      from: parsed.data.from,
      to: parsed.data.to,
    };
    const page = await this.repository.list(input.companyId, filters, parsed.data.limit, cursor);
    return {
      companyId: input.companyId,
      items: page.items.map(toAuditOutput),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    };
  }
}
