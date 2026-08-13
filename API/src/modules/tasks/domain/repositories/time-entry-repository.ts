import type { TimeEntry } from "@/modules/tasks/domain/entities/time-entry";

export interface TimeEntryRepository {
  create(entry: TimeEntry): Promise<TimeEntry>;
  listByTask(companyId: string, taskId: string, limit: number): Promise<TimeEntry[]>;
  sumDurationByTask(companyId: string, taskId: string): Promise<number>;
}
