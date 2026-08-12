import { z } from "zod";

import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { type TaskOutput, toTaskOutput } from "@/modules/tasks/application/dto/task-dtos";
import type { TaskUnitOfWork } from "@/modules/tasks/application/ports/task-unit-of-work";
import { TASK_STATUSES, type TaskStatus } from "@/modules/tasks/domain/entities/task";
import { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

const transitionTaskStatusSchema = z.object({ status: z.enum(TASK_STATUSES) }).strict();

export interface TransitionTaskStatusCommand {
  actor: AuthenticatedUser;
  taskId: string;
  status: TaskStatus;
  occurredAt?: Date;
}

export class TransitionTaskStatus implements UseCase<TransitionTaskStatusCommand, TaskOutput> {
  constructor(
    private readonly taskUnitOfWork: TaskUnitOfWork,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: TransitionTaskStatusCommand): Promise<TaskOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "tasks.update");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = transitionTaskStatusSchema.safeParse({ status: input.status });
    if (!parsed.success) {
      throw new ValidationError("Status de tarefa inválido", {
        details: { issues: parsed.error.issues },
      });
    }

    return this.taskUnitOfWork.execute(async ({ tasks, taskStatusHistory }) => {
      const task = await tasks.findByIdForUpdate(input.actor.companyId, input.taskId);
      if (!task) {
        throw new NotFoundError("Tarefa não encontrada");
      }

      if (task.assigneeId !== input.actor.userId) {
        this.authorization.assertPermission(input.actor, "kanban.manage");
      }

      const fromStatus = task.status;
      const transitionAt = input.occurredAt ?? new Date();
      task.transitionTo(parsed.data.status, transitionAt);

      const history = TaskStatusHistory.createTransition({
        taskId: task.id,
        fromStatus,
        toStatus: parsed.data.status,
        changedBy: input.actor.userId,
        changedAt: transitionAt,
        metadata: null,
      });

      const updatedTask = await tasks.update(task);
      await taskStatusHistory.create(history);

      return toTaskOutput(updatedTask);
    });
  }
}
