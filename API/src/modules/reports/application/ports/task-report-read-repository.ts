import type { TaskReportItem } from "@/modules/reports/application/read-models/task-report";
import type { TaskPriority, TaskStatus } from "@/modules/tasks/domain/entities/task";

export interface TaskReportQuery {
  companyId: string;
  periodStart?: string;
  periodEnd?: string;
  requisitionId?: string;
  employeeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  page: number;
  limit: number;
}

export interface TaskReportQueryResult {
  items: TaskReportItem[];
  total: number;
}

export interface TaskReportReadRepository {
  find(query: TaskReportQuery): Promise<TaskReportQueryResult>;
}
