import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type ListTasksInput,
  listTasksSchema,
  type TaskOutput,
  toTaskOutput,
} from "@/modules/tasks/application/dto/task-dtos";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface ListTasksCommand {
  actor: AuthenticatedUser;
  filters?: ListTasksInput;
}

export class ListTasks implements UseCase<ListTasksCommand, TaskOutput[]> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListTasksCommand): Promise<TaskOutput[]> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "tasks.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = listTasksSchema.safeParse(input.filters ?? {});
    if (!parsed.success) {
      throw new ValidationError("Filtros de tarefa inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const tasks = await this.taskRepository.listByCompany(input.actor.companyId, parsed.data);
    return tasks.map(toTaskOutput);
  }
}
