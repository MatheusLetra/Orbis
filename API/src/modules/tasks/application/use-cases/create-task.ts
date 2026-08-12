import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import {
  type CreateTaskInput,
  createTaskSchema,
  type TaskOutput,
  toTaskOutput,
} from "@/modules/tasks/application/dto/task-dtos";
import type { TaskUnitOfWork } from "@/modules/tasks/application/ports/task-unit-of-work";
import { Task } from "@/modules/tasks/domain/entities/task";
import { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface CreateTaskCommand {
  actor: AuthenticatedUser;
  data: CreateTaskInput;
}

export class CreateTask implements UseCase<CreateTaskCommand, TaskOutput> {
  constructor(
    private readonly taskUnitOfWork: TaskUnitOfWork,
    private readonly membershipRepository: MembershipRepository,
    private readonly requisitionRepository: RequisitionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: CreateTaskCommand): Promise<TaskOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "tasks.create");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = createTaskSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de tarefa inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    if (parsed.data.assigneeId) {
      const membership = await this.membershipRepository.findByUserAndCompany(
        parsed.data.assigneeId,
        input.actor.companyId,
      );
      if (!membership?.isActive) {
        throw new NotFoundError("Responsável da tarefa não encontrado");
      }
    }

    if (parsed.data.requisitionId) {
      const requisition = await this.requisitionRepository.findById(parsed.data.requisitionId);
      if (!requisition || requisition.companyId !== input.actor.companyId) {
        throw new NotFoundError("Requisição não encontrada");
      }
    }

    const task = Task.create({
      ...parsed.data,
      companyId: input.actor.companyId,
    });
    const initialHistory = TaskStatusHistory.createInitial({
      taskId: task.id,
      changedBy: input.actor.userId,
      changedAt: task.createdAt,
      metadata: null,
    });

    const created = await this.taskUnitOfWork.execute(async ({ tasks, taskStatusHistory }) => {
      const persistedTask = await tasks.create(task);
      await taskStatusHistory.create(initialHistory);
      return persistedTask;
    });

    return toTaskOutput(created);
  }
}
