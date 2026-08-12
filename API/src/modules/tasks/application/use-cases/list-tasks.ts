import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type ListTasksInput,
  listTasksSchema,
  type TaskCardOutput,
  toTaskCardOutput,
} from "@/modules/tasks/application/dto/task-dtos";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface ListTasksCommand {
  actor: AuthenticatedUser;
  filters?: ListTasksInput;
}

export class ListTasks implements UseCase<ListTasksCommand, TaskCardOutput[]> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListTasksCommand): Promise<TaskCardOutput[]> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "tasks.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = listTasksSchema.safeParse(input.filters ?? {});
    if (!parsed.success) {
      throw new ValidationError("Filtros de tarefa inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    if (
      parsed.data.scope === "own" &&
      parsed.data.assigneeId !== undefined &&
      parsed.data.assigneeId !== input.actor.userId
    ) {
      throw new ValidationError("assigneeId incompatível com o escopo próprio");
    }

    const filters = {
      ...parsed.data,
      assigneeId: parsed.data.scope === "own" ? input.actor.userId : parsed.data.assigneeId,
    };
    const tasks = await this.taskRepository.listByCompany(input.actor.companyId, filters);
    return tasks.map(toTaskCardOutput);
  }
}
