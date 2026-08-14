import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import { parseTaskReport, type TaskReportFilters } from "./report-contracts";

function params(filters: TaskReportFilters, page?: number) {
  const value = new URLSearchParams();
  for (const [key, item] of Object.entries(filters)) if (item) value.set(key, item);
  if (page !== undefined) value.set("page", String(page));
  return value;
}
export const reportClient = {
  list(
    companyId: string,
    filters: TaskReportFilters,
    page = 1,
    options?: Pick<RequestOptions, "signal">,
  ) {
    return apiClient
      .request<unknown>(
        `/companies/${encodeURIComponent(companyId)}/reports/tasks?${params(filters, page)}`,
        options,
      )
      .then(parseTaskReport);
  },
  async exportCsv(
    companyId: string,
    filters: TaskReportFilters,
    options?: Pick<RequestOptions, "signal">,
  ) {
    return apiClient.requestBlob(
      `/companies/${encodeURIComponent(companyId)}/reports/tasks/export?${params(filters)}`,
      options,
    );
  },
};
