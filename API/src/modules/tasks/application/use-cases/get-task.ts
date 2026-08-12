import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type TaskDetailOutput,
  toTaskDetailOutput,
  toTaskStatusHistoryOutput,
} from "@/modules/tasks/application/dto/task-dtos";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { TaskStatusHistoryRepository } from "@/modules/tasks/domain/repositories/task-status-history-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError } from "@/shared/errors/typed-errors";

export interface GetTaskCommand {
  actor: AuthenticatedUser;
  taskId: string;
}

export class GetTask implements UseCase<GetTaskCommand, TaskDetailOutput> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly historyRepository: TaskStatusHistoryRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetTaskCommand): Promise<TaskDetailOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "tasks.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const task = await this.taskRepository.findById(input.actor.companyId, input.taskId);
    if (!task) {
      throw new NotFoundError("Tarefa não encontrada");
    }

    const history = await this.historyRepository.listByTask(input.actor.companyId, input.taskId);

    return toTaskDetailOutput(task, history.map(toTaskStatusHistoryOutput));
  }
}
