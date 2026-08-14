import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import {
  NOOP_NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from "@/modules/notifications/application/ports/notification-dispatcher";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import {
  type TaskOutput,
  toTaskOutput,
  type UpdateTaskInput,
  updateTaskSchema,
} from "@/modules/tasks/application/dto/task-dtos";
import type { TaskUnitOfWork } from "@/modules/tasks/application/ports/task-unit-of-work";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface UpdateTaskCommand {
  actor: AuthenticatedUser;
  taskId: string;
  changes: UpdateTaskInput;
}

export class UpdateTask implements UseCase<UpdateTaskCommand, TaskOutput> {
  constructor(
    private readonly taskUnitOfWork: TaskUnitOfWork,
    private readonly membershipRepository: MembershipRepository,
    private readonly requisitionRepository: RequisitionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly notifications: NotificationDispatcher = NOOP_NOTIFICATION_DISPATCHER,
  ) {}

  async execute(input: UpdateTaskCommand): Promise<TaskOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "tasks.update");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = updateTaskSchema.safeParse(input.changes);
    if (!parsed.success) {
      throw new ValidationError("Dados de tarefa inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const { updated, previousAssigneeId } = await this.taskUnitOfWork.execute(async ({ tasks }) => {
      const task = await tasks.findByIdForUpdate(input.actor.companyId, input.taskId);
      if (!task) {
        throw new NotFoundError("Tarefa não encontrada");
      }

      const previousAssigneeId = task.assigneeId;
      const canManageCompanyTasks = input.actor.permissions.includes("kanban.manage");
      const requestedAssigneeId = parsed.data.assigneeId;
      const isSelfClaim = task.assigneeId === null && requestedAssigneeId === input.actor.userId;
      const editsOwnTaskWithoutReassignment =
        task.assigneeId === input.actor.userId &&
        (requestedAssigneeId === undefined || requestedAssigneeId === input.actor.userId);

      if (!canManageCompanyTasks && !isSelfClaim && !editsOwnTaskWithoutReassignment) {
        this.authorization.assertPermission(input.actor, "kanban.manage");
      }

      const assigneeId =
        parsed.data.assigneeId !== undefined ? parsed.data.assigneeId : task.assigneeId;
      const requisitionId =
        parsed.data.requisitionId !== undefined ? parsed.data.requisitionId : task.requisitionId;

      if (assigneeId !== null) {
        const membership = await this.membershipRepository.findByUserAndCompany(
          assigneeId,
          input.actor.companyId,
        );
        if (!membership?.isActive) {
          throw new NotFoundError("Responsável da tarefa não encontrado");
        }
      }

      if (requisitionId !== null) {
        const requisition = await this.requisitionRepository.findById(requisitionId);
        if (!requisition || requisition.companyId !== input.actor.companyId) {
          throw new NotFoundError("Requisição não encontrada");
        }
      }

      if (parsed.data.title !== undefined) {
        task.rename(parsed.data.title);
      }
      if (parsed.data.description !== undefined) {
        task.changeDescription(parsed.data.description);
      }
      if (parsed.data.priority !== undefined) {
        task.changePriority(parsed.data.priority);
      }
      if (parsed.data.assigneeId !== undefined) {
        task.changeAssignee(parsed.data.assigneeId);
      }
      if (parsed.data.requisitionId !== undefined) {
        task.changeRequisition(parsed.data.requisitionId);
      }
      if (parsed.data.startDate !== undefined) {
        task.changeStartDate(parsed.data.startDate);
      }
      if (parsed.data.plannedEndDate !== undefined) {
        task.changePlannedEndDate(parsed.data.plannedEndDate);
      }

      return { updated: await tasks.update(task), previousAssigneeId };
    });

    if (updated.assigneeId && updated.assigneeId !== previousAssigneeId) {
      await this.notifications
        .handle({
          eventType: "TASK_ASSIGNED",
          companyId: updated.companyId,
          actorId: input.actor.userId,
          recipientIds: [updated.assigneeId],
          title: "Tarefa atribuída",
          body: updated.title,
          data: { taskId: updated.id },
        })
        .catch(() => undefined);
    }

    return toTaskOutput(updated);
  }
}
