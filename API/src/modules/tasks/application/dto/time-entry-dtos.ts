import { z } from "zod";

import type { TimeEntry } from "@/modules/tasks/domain/entities/time-entry";

export const listTimeEntriesSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict();

export type ListTimeEntriesInput = z.infer<typeof listTimeEntriesSchema>;

export const registerTimeEntrySchema = z
  .object({
    durationMinutes: z.number().int().min(1).max(1440),
    description: z.string().trim().max(1000).optional(),
  })
  .strict();

export type RegisterTimeEntryInput = z.infer<typeof registerTimeEntrySchema>;

export interface TimeEntryOutput {
  id: string;
  companyId: string;
  taskId: string;
  userId: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  description: string | null;
  createdAt: string;
}

export interface TimeEntryListOutput {
  items: TimeEntryOutput[];
  totalDurationMinutes: number;
  hasMore: boolean;
}

export function toTimeEntryOutput(entry: TimeEntry): TimeEntryOutput {
  return {
    id: entry.id,
    companyId: entry.companyId,
    taskId: entry.taskId,
    userId: entry.userId,
    startedAt: entry.startedAt?.toISOString() ?? null,
    endedAt: entry.endedAt?.toISOString() ?? null,
    durationMinutes: entry.durationMinutes,
    description: entry.description,
    createdAt: entry.createdAt.toISOString(),
  };
}
