import {
  type AuditRecorder,
  NOOP_AUDIT_RECORDER,
} from "@/modules/audit/application/ports/audit-recorder";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface DeleteRequisitionCommand {
  actor: AuthenticatedUser;
  requisitionId: string;
}

export class DeleteRequisition implements UseCase<DeleteRequisitionCommand, { id: string }> {
  constructor(
    private readonly requisitionRepository: RequisitionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditRecorder = NOOP_AUDIT_RECORDER,
  ) {}

  async execute(input: DeleteRequisitionCommand): Promise<{ id: string }> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "requisitions.delete");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const requisition = await this.requisitionRepository.findById(input.requisitionId);
    if (!requisition || requisition.companyId !== input.actor.companyId) {
      throw new NotFoundError("Requisição não encontrada");
    }

    await this.requisitionRepository.delete(input.requisitionId);

    await this.audit.record({
      companyId: requisition.companyId,
      actorUserId: input.actor.userId,
      action: "REQUISITION_DELETED",
      entityType: "REQUISITION",
      entityId: requisition.id,
      metadata: { number: requisition.number },
    });

    return { id: input.requisitionId };
  }
}
