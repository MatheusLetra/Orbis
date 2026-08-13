import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import {
  parseTimeEntryListOutput,
  parseTimeEntryOutput,
  type TimeEntryListOutput,
  type TimeEntryOutput,
} from "./time-entry-contracts";

export interface CreateTimeEntryInput {
  durationMinutes: number;
  description?: string;
}

export interface CreateTimeEntryOptions extends Pick<RequestOptions, "signal"> {}

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

  createForTask(
    companyId: string,
    taskId: string,
    input: CreateTimeEntryInput,
    options: CreateTimeEntryOptions = {},
  ): Promise<TimeEntryOutput> {
    const description = input.description?.trim();
    const body: CreateTimeEntryInput = {
      durationMinutes: input.durationMinutes,
      ...(description ? { description } : {}),
    };
    const path = `/companies/${encodeURIComponent(companyId)}/tasks/${encodeURIComponent(taskId)}/time-entries`;

    return apiClient
      .request<unknown>(path, { method: "POST", body, signal: options.signal })
      .then(parseTimeEntryOutput);
  },
};
