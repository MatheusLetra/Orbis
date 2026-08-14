import { z } from "zod";

import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/modules/tasks/domain/entities/task";
import type { WeeklyTimelineReadRepository } from "@/modules/timeline/application/ports/weekly-timeline-read-repository";
import type {
  TimelineTask,
  WeeklyTimelineReadModel,
  WeeklyTimelineTaskRow,
} from "@/modules/timeline/application/read-models/weekly-timeline";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const inputSchema = z
  .object({
    companyId: z.string().uuid("companyId inválido"),
    weekStart: z.string().regex(calendarDatePattern, "weekStart inválido"),
    assigneeId: z.string().uuid("assigneeId inválido").optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
  })
  .strict();

export interface GetWeeklyTimelineCommand {
  actor: AuthenticatedUser;
  companyId: string;
  weekStart: string;
  filters?: {
    assigneeId?: string;
    status?: (typeof TASK_STATUSES)[number];
    priority?: (typeof TASK_PRIORITIES)[number];
  };
}

export class GetWeeklyTimeline
  implements UseCase<GetWeeklyTimelineCommand, WeeklyTimelineReadModel>
{
  constructor(
    private readonly repository: WeeklyTimelineReadRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetWeeklyTimelineCommand): Promise<WeeklyTimelineReadModel> {
    const parsed = inputSchema.safeParse({
      companyId: input.companyId,
      weekStart: input.weekStart,
      ...input.filters,
    });
    if (!parsed.success) {
      throw new ValidationError("Filtros da timeline inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const weekStartDate = parseCalendarDate(parsed.data.weekStart);
    if (weekStartDate?.getUTCDay() !== 1) {
      throw new ValidationError("weekStart deve ser uma segunda-feira válida");
    }

    this.authorization.assertCompanyContext(input.actor, parsed.data.companyId);
    this.authorization.assertPermission(input.actor, "tasks.read");
    await this.accessService.assertAccess(input.actor.userId, parsed.data.companyId);

    const company = await this.companyRepository.findById(parsed.data.companyId);
    if (!company?.isActive) throw new NotFoundError("Empresa não encontrada");

    const weekEnd = addDays(parsed.data.weekStart, 6);
    const result = await this.repository.findWeekly({
      companyId: parsed.data.companyId,
      weekStart: parsed.data.weekStart,
      weekEnd,
      assigneeId: parsed.data.assigneeId,
      status: parsed.data.status,
      priority: parsed.data.priority,
    });

    const days = Array.from({ length: 5 }, (_, index) => ({
      date: addDays(parsed.data.weekStart, index),
      isBusinessDay: true as const,
      tasks: [] as TimelineTask[],
    }));
    const undatedTasks: TimelineTask[] = [];
    const overdueTasks: TimelineTask[] = [];
    const weekendTasks: TimelineTask[] = [];
    for (const row of [...result.tasks].sort(compareRows)) {
      const normalized = normalize(row, parsed.data.weekStart);
      if (isUndated(row)) {
        undatedTasks.push(normalized);
        continue;
      }

      const effectiveStart = row.startDate ?? row.plannedEndDate;
      const effectiveEnd = row.plannedEndDate ?? row.startDate;
      if (effectiveStart === null || effectiveEnd === null) continue;

      const intersectedDays = days.filter(
        (day) => effectiveStart <= day.date && effectiveEnd >= day.date,
      );
      if (intersectedDays.length > 0) {
        for (const day of intersectedDays) day.tasks.push(normalized);
        continue;
      }

      if (effectiveStart <= weekEnd && effectiveEnd >= parsed.data.weekStart) {
        weekendTasks.push(normalized);
      } else if (normalized.isOverdue) {
        overdueTasks.push(normalized);
      }
    }

    return {
      companyId: parsed.data.companyId,
      weekStart: parsed.data.weekStart,
      weekEnd,
      days,
      undatedTasks,
      overdueTasks,
      weekendTasks,
      assignees: result.assignees,
    };
  }
}

function normalize(row: WeeklyTimelineTaskRow, weekStart: string): TimelineTask {
  return {
    id: row.id,
    companyId: row.companyId,
    requisitionId: row.requisitionId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assigneeId: row.assigneeId,
    startDate: row.startDate,
    plannedEndDate: row.plannedEndDate,
    completedAt: row.completedAt,
    isOverdue:
      row.plannedEndDate !== null && row.plannedEndDate < weekStart && row.status !== "DONE",
    isPaused: row.status === "PAUSED",
  };
}

function isUndated(row: WeeklyTimelineTaskRow): boolean {
  return (
    (row.startDate === null && row.plannedEndDate === null) ||
    (row.startDate !== null && row.plannedEndDate !== null && row.startDate > row.plannedEndDate)
  );
}

function compareRows(left: WeeklyTimelineTaskRow, right: WeeklyTimelineTaskRow): number {
  const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  return (
    compareNullable(left.startDate, right.startDate) ||
    compareNullable(left.plannedEndDate, right.plannedEndDate) ||
    priority[left.priority] - priority[right.priority] ||
    compareString(left.title, right.title) ||
    compareString(left.id, right.id)
  );
}

function compareNullable(left: string | null, right: string | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return compareString(left, right);
}

function compareString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseCalendarDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
