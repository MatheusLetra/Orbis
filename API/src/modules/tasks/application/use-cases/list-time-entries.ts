import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  listTimeEntriesSchema,
  type TimeEntryListOutput,
  toTimeEntryOutput,
} from "@/modules/tasks/application/dto/time-entry-dtos";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { TimeEntryRepository } from "@/modules/tasks/domain/repositories/time-entry-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface ListTimeEntriesCommand {
  actor: AuthenticatedUser;
  taskId: string;
  filters?: unknown;
}

export class ListTimeEntries implements UseCase<ListTimeEntriesCommand, TimeEntryListOutput> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly timeEntryRepository: TimeEntryRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListTimeEntriesCommand): Promise<TimeEntryListOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "tasks.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = listTimeEntriesSchema.safeParse(input.filters ?? {});
    if (!parsed.success) {
      throw new ValidationError("Filtros de apontamento inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const task = await this.taskRepository.findById(input.actor.companyId, input.taskId);
    if (!task) {
      throw new NotFoundError("Tarefa não encontrada");
    }

    const [entries, totalDurationMinutes] = await Promise.all([
      this.timeEntryRepository.listByTask(
        input.actor.companyId,
        input.taskId,
        parsed.data.limit + 1,
      ),
      this.timeEntryRepository.sumDurationByTask(input.actor.companyId, input.taskId),
    ]);
    const hasMore = entries.length > parsed.data.limit;

    return {
      items: entries.slice(0, parsed.data.limit).map(toTimeEntryOutput),
      totalDurationMinutes,
      hasMore,
    };
  }
}
