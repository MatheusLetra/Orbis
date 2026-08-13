import { useQuery } from "@tanstack/react-query";
import { timeEntriesClient } from "./time-entry-client";
import { DEFAULT_TIME_ENTRY_LIMIT, timeEntryKeys } from "./time-entry-keys";

export interface UseTaskTimeEntriesOptions {
  enabled?: boolean;
  limit?: number;
}

export function useTaskTimeEntries(
  companyId: string | null,
  taskId: string | null,
  options: UseTaskTimeEntriesOptions = {},
) {
  const limit = options.limit ?? DEFAULT_TIME_ENTRY_LIMIT;

  return useQuery({
    queryKey:
      companyId && taskId
        ? timeEntryKeys.task(companyId, taskId, limit)
        : ["time-entries", "task", "disabled", limit],
    queryFn: ({ signal }) =>
      timeEntriesClient.listForTask(companyId as string, taskId as string, { limit, signal }),
    enabled: Boolean(companyId && taskId && (options.enabled ?? false)),
  });
}
