import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import { parseYearlyTimeline, type YearlyFilters } from "./yearly-contracts";
import { normalizeYearlyFilters } from "./yearly-keys";

export const yearlyTimelineClient = {
  list(
    companyId: string,
    year: string,
    filters: YearlyFilters = {},
    options?: Pick<RequestOptions, "signal">,
  ) {
    const params = new URLSearchParams({ year });
    for (const [key, value] of Object.entries(normalizeYearlyFilters(filters))) {
      if (value !== undefined) params.set(key, value);
    }
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/timeline/yearly?${params.toString()}`,
        options,
      )
      .then(parseYearlyTimeline);
  },
};
