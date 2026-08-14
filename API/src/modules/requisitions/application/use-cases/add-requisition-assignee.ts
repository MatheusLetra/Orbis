import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import {
  NOOP_NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from "@/modules/notifications/application/ports/notification-dispatcher";
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

export interface AddRequisitionAssigneeCommand {
  actor: AuthenticatedUser;
  requisitionId: string;
  userId: string;
}

export class AddRequisitionAssignee
  implements UseCase<AddRequisitionAssigneeCommand, RequisitionAssigneeOutput>
{
  constructor(
    private readonly requisitionRepository: RequisitionRepository,
    private readonly requisitionAssigneeRepository: RequisitionAssigneeRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly notifications: NotificationDispatcher = NOOP_NOTIFICATION_DISPATCHER,
  ) {}

  async execute(input: AddRequisitionAssigneeCommand): Promise<RequisitionAssigneeOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "requisitions.update");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const requisition = await this.requisitionRepository.findById(input.requisitionId);
    if (!requisition || requisition.companyId !== input.actor.companyId) {
      throw new NotFoundError("Requisição não encontrada");
    }

    const membership = await this.membershipRepository.findByUserAndCompany(
      input.userId,
      input.actor.companyId,
    );
    if (!membership?.isActive) {
      throw new NotFoundError("Membro não encontrado");
    }

    const existing = await this.requisitionAssigneeRepository.findByRequisitionAndUser(
      input.actor.companyId,
      input.requisitionId,
      input.userId,
    );
    const assignee =
      existing ??
      (await this.requisitionAssigneeRepository.create(
        input.actor.companyId,
        input.requisitionId,
        input.userId,
      ));

    if (!existing && requisition.responsibleId) {
      await this.notifications
        .handle({
          eventType: "REQUISITION_ASSIGNED",
          companyId: requisition.companyId,
          actorId: input.actor.userId,
          recipientIds: [requisition.responsibleId],
          title: "Requisição atribuída",
          body: requisition.title,
          data: { requisitionId: requisition.id },
        })
        .catch(() => undefined);
    }

    return toRequisitionAssigneeOutput(assignee);
  }
}
