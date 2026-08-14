import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import type { MonthlyFilters } from "./monthly-contracts";
import { parseMonthlyTimeline } from "./monthly-contracts";
import { normalizeMonthlyFilters } from "./monthly-keys";

export const monthlyTimelineClient = {
  list(
    companyId: string,
    period: string,
    filters: MonthlyFilters = {},
    options?: Pick<RequestOptions, "signal">,
  ) {
    const params = new URLSearchParams({ period });
    for (const [key, value] of Object.entries(normalizeMonthlyFilters(filters))) {
      if (value !== undefined) params.set(key, value);
    }
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/timeline/monthly?${params.toString()}`,
        options,
      )
      .then(parseMonthlyTimeline);
  },
};
