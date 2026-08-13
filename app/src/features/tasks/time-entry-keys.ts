export const DEFAULT_TIME_ENTRY_LIMIT = 100;

export const timeEntryKeys = {
  all: ["time-entries"] as const,
  task: (companyId: string, taskId: string, limit = DEFAULT_TIME_ENTRY_LIMIT) =>
    [...timeEntryKeys.all, "task", companyId, taskId, limit] as const,
};
