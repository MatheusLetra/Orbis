import type { TaskPriority, TaskStatus } from "@/modules/tasks/domain/entities/task";
import type {
  TimelineAssignee,
  WeeklyTimelineTaskRow,
} from "@/modules/timeline/application/read-models/weekly-timeline";

export interface WeeklyTimelineFilters {
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface WeeklyTimelineQuery extends WeeklyTimelineFilters {
  companyId: string;
  weekStart: string;
  weekEnd: string;
}

export interface WeeklyTimelineQueryResult {
  tasks: WeeklyTimelineTaskRow[];
  assignees: TimelineAssignee[];
}

export interface WeeklyTimelineReadRepository {
  findWeekly(query: WeeklyTimelineQuery): Promise<WeeklyTimelineQueryResult>;
}
