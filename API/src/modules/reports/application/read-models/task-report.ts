import type { TaskPriority, TaskStatus } from "@/modules/tasks/domain/entities/task";

export interface TaskReportItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  issuedAt: string;
  plannedEndDate: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  requisitionId: string | null;
  requisitionNumber: number | null;
  requisitionTitle: string | null;
  estimatedHours: number | null;
  workedHours: number;
}

export interface TaskReportReadModel {
  companyId: string;
  items: TaskReportItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
