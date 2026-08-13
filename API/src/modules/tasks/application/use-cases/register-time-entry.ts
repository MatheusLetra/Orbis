import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type RegisterTimeEntryInput,
  registerTimeEntrySchema,
  type TimeEntryOutput,
  toTimeEntryOutput,
} from "@/modules/tasks/application/dto/time-entry-dtos";
import type { TaskUnitOfWork } from "@/modules/tasks/application/ports/task-unit-of-work";
import { TimeEntry } from "@/modules/tasks/domain/entities/time-entry";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface RegisterTimeEntryCommand {
  actor: AuthenticatedUser;
  taskId: string;
  data: RegisterTimeEntryInput;
}

export class RegisterTimeEntry implements UseCase<RegisterTimeEntryCommand, TimeEntryOutput> {
  constructor(
    private readonly taskUnitOfWork: TaskUnitOfWork,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: RegisterTimeEntryCommand): Promise<TimeEntryOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "hours.register");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = registerTimeEntrySchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de apontamento inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    return this.taskUnitOfWork.execute(async ({ tasks, timeEntries }) => {
      const task = await tasks.findByIdForUpdate(input.actor.companyId, input.taskId);
      if (!task) {
        throw new NotFoundError("Tarefa não encontrada");
      }

      if (task.assigneeId !== input.actor.userId) {
        if (!input.actor.permissions.includes("kanban.manage")) {
          throw new ForbiddenError("Apontamento permitido somente na própria tarefa");
        }
      }

      const entry = TimeEntry.create({
        companyId: task.companyId,
        taskId: task.id,
        userId: input.actor.userId,
        ...parsed.data,
      });

      return toTimeEntryOutput(await timeEntries.create(entry));
    });
  }
}
