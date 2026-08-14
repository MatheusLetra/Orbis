import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type {
  MonthlyRequisitionTimelineQuery,
  MonthlyRequisitionTimelineReadRepository,
} from "@/modules/timeline/application/ports/monthly-requisition-timeline-read-repository";
import type {
  WeeklyTimelineQuery,
  WeeklyTimelineQueryResult,
  WeeklyTimelineReadRepository,
} from "@/modules/timeline/application/ports/weekly-timeline-read-repository";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";

export class InMemoryWeeklyTimelineReadRepository implements WeeklyTimelineReadRepository {
  calls: WeeklyTimelineQuery[] = [];

  constructor(
    private readonly tasks: TaskRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
  ) {}

  async findWeekly(query: WeeklyTimelineQuery): Promise<WeeklyTimelineQueryResult> {
    this.calls.push(query);
    const taskItems = await this.tasks.listByCompany(query.companyId, {
      assigneeId: query.assigneeId,
      status: query.status,
      priority: query.priority,
    });
    const rows = taskItems
      .filter(({ task }) => {
        const start = task.startDate?.toISOString().slice(0, 10) ?? null;
        const end = task.plannedEndDate?.toISOString().slice(0, 10) ?? null;
        const effectiveStart = start ?? end;
        const effectiveEnd = end ?? start;
        return (
          (start === null && end === null) ||
          (start !== null && end !== null && start > end) ||
          (end !== null && end < query.weekStart && task.status !== "DONE") ||
          (effectiveStart !== null &&
            effectiveEnd !== null &&
            effectiveStart <= query.weekEnd &&
            effectiveEnd >= query.weekStart)
        );
      })
      .map(({ task }) => ({
        id: task.id,
        companyId: task.companyId,
        requisitionId: task.requisitionId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        startDate: task.startDate?.toISOString().slice(0, 10) ?? null,
        plannedEndDate: task.plannedEndDate?.toISOString().slice(0, 10) ?? null,
        assigneeId: task.assigneeId,
        completedAt: task.completedAt?.toISOString() ?? null,
      }));
    const assignedUserIds = new Set(
      (await this.tasks.listByCompany(query.companyId))
        .map(({ task }) => task.assigneeId)
        .filter((id): id is string => id !== null),
    );
    const assignees = (
      await Promise.all(
        (
          await this.memberships.listByCompany(query.companyId)
        )
          .filter((membership) => membership.isActive && assignedUserIds.has(membership.userId))
          .map(async (membership) => {
            const user = await this.users.findById(membership.userId);
            return user?.isActive ? { id: user.id, name: user.name } : null;
          }),
      )
    )
      .filter((item): item is { id: string; name: string } => item !== null)
      .sort(
        (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
      );

    return { tasks: rows, assignees };
  }
}

export class InMemoryMonthlyRequisitionTimelineReadRepository
  implements MonthlyRequisitionTimelineReadRepository
{
  calls: MonthlyRequisitionTimelineQuery[] = [];

  constructor(private readonly requisitions: RequisitionRepository) {}

  async findMonthly(query: MonthlyRequisitionTimelineQuery) {
    this.calls.push(query);
    const rows = await this.requisitions.listByCompany(query.companyId, {
      priority: query.priority,
      responsibleId: query.assigneeId,
      status: query.status,
    });
    return rows
      .filter((requisition) => {
        const start = requisition.startDate?.toISOString().slice(0, 10) ?? null;
        const end = requisition.plannedDeliveryDate?.toISOString().slice(0, 10) ?? null;
        return (
          (start === null && end === null) ||
          (start !== null && end !== null && start > end) ||
          (end !== null && end < query.periodStart && requisition.deliveredAt === null) ||
          (start !== null &&
            start <= query.periodEnd &&
            (end === null || end >= query.periodStart)) ||
          (end !== null && end >= query.periodStart && (start === null || start <= query.periodEnd))
        );
      })
      .map((requisition) => ({
        requisitionId: requisition.id,
        number: requisition.number,
        title: requisition.title,
        priority: requisition.priority,
        assigneeId: requisition.responsibleId,
        startDate: requisition.startDate?.toISOString().slice(0, 10) ?? null,
        plannedDeliveryDate: requisition.plannedDeliveryDate?.toISOString().slice(0, 10) ?? null,
        deliveredAt: requisition.deliveredAt,
        estimatedHours: requisition.estimatedHours,
      }));
  }
}
