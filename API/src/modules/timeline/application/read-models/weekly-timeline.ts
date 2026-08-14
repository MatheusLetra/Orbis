import type { TaskPriority, TaskStatus } from "@/modules/tasks/domain/entities/task";

export interface TimelineAssignee {
  id: string;
  name: string;
}

export interface WeeklyTimelineTaskRow {
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
}

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

export interface WeeklyTimelineReadModel {
  companyId: string;
  weekStart: string;
  weekEnd: string;
  days: { date: string; isBusinessDay: true; tasks: TimelineTask[] }[];
  undatedTasks: TimelineTask[];
  overdueTasks: TimelineTask[];
  weekendTasks: TimelineTask[];
  assignees: TimelineAssignee[];
}
