import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import { parseTimeEntryListOutput, type TimeEntryListOutput } from "./time-entry-contracts";

export interface ListTimeEntriesOptions extends Pick<RequestOptions, "signal"> {
  limit?: number;
}

export const timeEntriesClient = {
  listForTask(
    companyId: string,
    taskId: string,
    options: ListTimeEntriesOptions = {},
  ): Promise<TimeEntryListOutput> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    const query = params.toString();
    const path = `/companies/${encodeURIComponent(companyId)}/tasks/${encodeURIComponent(taskId)}/time-entries${query ? `?${query}` : ""}`;

    return apiClient
      .request<unknown>(path, { signal: options.signal })
      .then(parseTimeEntryListOutput);
  },
};
