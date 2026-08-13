export const attachmentKeys = {
  all: ["attachments"] as const,
  task: (companyId: string, taskId: string) =>
    [...attachmentKeys.all, "task", companyId, taskId] as const,
};
