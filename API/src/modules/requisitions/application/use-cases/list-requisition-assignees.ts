import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type RequisitionAssigneeOutput,
  toRequisitionAssigneeOutput,
} from "@/modules/requisitions/application/dto/requisition-dtos";
import type { RequisitionAssigneeRepository } from "@/modules/requisitions/domain/repositories/requisition-assignee-repository";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface ListRequisitionAssigneesCommand {
  actor: AuthenticatedUser;
  requisitionId: string;
}

export class ListRequisitionAssignees
  implements UseCase<ListRequisitionAssigneesCommand, RequisitionAssigneeOutput[]>
{
  constructor(
    private readonly requisitionRepository: RequisitionRepository,
    private readonly requisitionAssigneeRepository: RequisitionAssigneeRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListRequisitionAssigneesCommand): Promise<RequisitionAssigneeOutput[]> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "requisitions.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const requisition = await this.requisitionRepository.findById(input.requisitionId);
    if (!requisition || requisition.companyId !== input.actor.companyId) {
      throw new NotFoundError("Requisição não encontrada");
    }

    const assignees = await this.requisitionAssigneeRepository.listByRequisition(
      input.actor.companyId,
      input.requisitionId,
    );

    return [...assignees]
      .sort((left, right) => {
        const createdAtDifference = left.createdAt.getTime() - right.createdAt.getTime();
        return createdAtDifference || left.userId.localeCompare(right.userId);
      })
      .map(toRequisitionAssigneeOutput);
  }
}
