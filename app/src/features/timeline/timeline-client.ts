import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import type { TimelineFilters } from "./timeline-contracts";
import { parseWeeklyTimeline } from "./timeline-contracts";
import { normalizeTimelineFilters } from "./timeline-keys";

export const timelineClient = {
  weekly(
    companyId: string,
    weekStart: string,
    filters: TimelineFilters = {},
    options?: Pick<RequestOptions, "signal">,
  ) {
    const params = new URLSearchParams({ weekStart });
    for (const [key, value] of Object.entries(normalizeTimelineFilters(filters))) {
      if (value !== undefined) params.set(key, value);
    }
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/timeline/weekly?${params.toString()}`,
        options,
      )
      .then(parseWeeklyTimeline);
  },
};
