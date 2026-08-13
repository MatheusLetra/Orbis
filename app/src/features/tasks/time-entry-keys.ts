export const DEFAULT_TIME_ENTRY_LIMIT = 100;

export const timeEntryKeys = {
  all: ["time-entries"] as const,
  taskPrefix: (companyId: string, taskId: string) =>
    [...timeEntryKeys.all, "task", companyId, taskId] as const,
  task: (companyId: string, taskId: string, limit = DEFAULT_TIME_ENTRY_LIMIT) =>
    [...timeEntryKeys.taskPrefix(companyId, taskId), limit] as const,
};
