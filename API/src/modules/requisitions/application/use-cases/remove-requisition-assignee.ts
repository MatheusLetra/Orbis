import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { RequisitionAssigneeRepository } from "@/modules/requisitions/domain/repositories/requisition-assignee-repository";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface RemoveRequisitionAssigneeCommand {
  actor: AuthenticatedUser;
  requisitionId: string;
  userId: string;
}

export interface RemoveRequisitionAssigneeOutput {
  requisitionId: string;
  userId: string;
}

export class RemoveRequisitionAssignee
  implements UseCase<RemoveRequisitionAssigneeCommand, RemoveRequisitionAssigneeOutput>
{
  constructor(
    private readonly requisitionRepository: RequisitionRepository,
    private readonly requisitionAssigneeRepository: RequisitionAssigneeRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: RemoveRequisitionAssigneeCommand): Promise<RemoveRequisitionAssigneeOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "requisitions.update");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const requisition = await this.requisitionRepository.findById(input.requisitionId);
    if (!requisition || requisition.companyId !== input.actor.companyId) {
      throw new NotFoundError("Requisição não encontrada");
    }

    const existing = await this.requisitionAssigneeRepository.findByRequisitionAndUser(
      input.actor.companyId,
      input.requisitionId,
      input.userId,
    );
    if (existing) {
      await this.requisitionAssigneeRepository.delete(
        input.actor.companyId,
        input.requisitionId,
        input.userId,
      );
    }

    return {
      requisitionId: input.requisitionId,
      userId: input.userId,
    };
  }
}
