import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@/features/tasks/task-contracts";

export interface TimelineTask {
  id: string;
  companyId: string;
  requisitionId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  isPaused: boolean;
}

export interface TimelineAssignee {
  id: string;
  name: string;
}

export interface TimelineDay {
  date: string;
  isBusinessDay: true;
  tasks: TimelineTask[];
}

export interface WeeklyTimeline {
  companyId: string;
  weekStart: string;
  weekEnd: string;
  days: TimelineDay[];
  undatedTasks: TimelineTask[];
  overdueTasks: TimelineTask[];
  weekendTasks: TimelineTask[];
  assignees: TimelineAssignee[];
}

export interface TimelineFilters {
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function parseWeeklyTimeline(value: unknown): WeeklyTimeline {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "companyId",
      "weekStart",
      "weekEnd",
      "days",
      "undatedTasks",
      "overdueTasks",
      "weekendTasks",
      "assignees",
    ]) ||
    typeof value.companyId !== "string"
  )
    return invalid();
  if (!isCalendarDate(value.weekStart) || !isCalendarDate(value.weekEnd)) return invalid();
  if (
    !Array.isArray(value.days) ||
    !Array.isArray(value.undatedTasks) ||
    !Array.isArray(value.overdueTasks) ||
    !Array.isArray(value.weekendTasks) ||
    !Array.isArray(value.assignees)
  ) {
    return invalid();
  }

  const expectedDates = Array.from({ length: 5 }, (_, index) =>
    addCalendarDays(value.weekStart as string, index),
  );
  if (
    !isValidWeekStart(value.weekStart) ||
    value.weekEnd !== addCalendarDays(value.weekStart, 6) ||
    value.days.length !== 5
  ) {
    return invalid();
  }

  const days = value.days.map((day, index) => parseDay(day, expectedDates[index] as string));
  const undatedTasks = value.undatedTasks.map(parseTask);
  const overdueTasks = value.overdueTasks.map(parseTask);
  const weekendTasks = value.weekendTasks.map(parseTask);
  const assignees = value.assignees.map(parseAssignee);
  if (
    [...days.flatMap((day) => day.tasks), ...undatedTasks, ...overdueTasks, ...weekendTasks].some(
      (task) => task.companyId !== value.companyId,
    )
  ) {
    return invalid();
  }

  return {
    companyId: value.companyId,
    weekStart: value.weekStart,
    weekEnd: value.weekEnd,
    days,
    undatedTasks,
    overdueTasks,
    weekendTasks,
    assignees,
  };
}

function parseDay(value: unknown, expectedDate: string): TimelineDay {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["date", "isBusinessDay", "tasks"]) ||
    value.date !== expectedDate ||
    value.isBusinessDay !== true ||
    !Array.isArray(value.tasks)
  ) {
    return invalid();
  }
  return { date: value.date, isBusinessDay: true, tasks: value.tasks.map(parseTask) };
}

function parseTask(value: unknown): TimelineTask {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "companyId",
      "requisitionId",
      "title",
      "description",
      "priority",
      "status",
      "assigneeId",
      "startDate",
      "plannedEndDate",
      "completedAt",
      "isOverdue",
      "isPaused",
    ]) ||
    typeof value.id !== "string" ||
    typeof value.companyId !== "string" ||
    !(typeof value.requisitionId === "string" || value.requisitionId === null) ||
    typeof value.title !== "string" ||
    !(typeof value.description === "string" || value.description === null) ||
    !TASK_PRIORITIES.includes(value.priority as TaskPriority) ||
    !TASK_STATUSES.includes(value.status as TaskStatus) ||
    !(typeof value.assigneeId === "string" || value.assigneeId === null) ||
    !(value.startDate === null || isCalendarDate(value.startDate)) ||
    !(value.plannedEndDate === null || isCalendarDate(value.plannedEndDate)) ||
    !(value.completedAt === null || isIsoInstant(value.completedAt)) ||
    typeof value.isOverdue !== "boolean" ||
    typeof value.isPaused !== "boolean"
  ) {
    return invalid();
  }
  return value as unknown as TimelineTask;
}

function parseAssignee(value: unknown): TimelineAssignee {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["id", "name"]) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string"
  ) {
    return invalid();
  }
  return { id: value.id, name: value.name };
}

function isIsoInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => expected.has(key))
  );
}

function calendarDay(value: string): number {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isValidWeekStart(value: unknown): value is string {
  return isCalendarDate(value) && calendarDay(value) === 1;
}

export function addCalendarDays(value: string, amount: number): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function invalid(): never {
  throw new Error("Contrato da timeline semanal inválido");
}
