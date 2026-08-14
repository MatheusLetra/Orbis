export const REPORT_STATUSES = ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] as const;
export const REPORT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ReportPriority = (typeof REPORT_PRIORITIES)[number];

export interface TaskReportFilters {
  periodStart?: string;
  periodEnd?: string;
  requisitionId?: string;
  employeeId?: string;
  status?: ReportStatus;
  priority?: ReportPriority;
}
export interface TaskReportItem {
  id: string;
  title: string;
  status: ReportStatus;
  priority: ReportPriority;
  issuedAt: string;
  plannedEndDate: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  requisitionId: string | null;
  requisitionNumber: number | null;
  requisitionTitle: string | null;
  estimatedHours: number | null;
  workedHours: number;
}
export interface TaskReport {
  companyId: string;
  items: TaskReportItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const keys = [
  "id",
  "title",
  "status",
  "priority",
  "issuedAt",
  "plannedEndDate",
  "completedAt",
  "assigneeId",
  "assigneeName",
  "requisitionId",
  "requisitionNumber",
  "requisitionTitle",
  "estimatedHours",
  "workedHours",
] as const;
const reportKeys = ["companyId", "items", "total", "page", "limit", "hasMore"] as const;
const date = /^\d{4}-\d{2}-\d{2}$/;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function only(value: Record<string, unknown>, allowed: readonly string[]) {
  return (
    Object.keys(value).length === allowed.length &&
    Object.keys(value).every((key) => allowed.includes(key))
  );
}
function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
function nullableDate(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && date.test(value));
}
function instant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}
export function parseTaskReport(value: unknown): TaskReport {
  if (
    !record(value) ||
    !only(value, reportKeys) ||
    typeof value.companyId !== "string" ||
    !Array.isArray(value.items) ||
    typeof value.total !== "number" ||
    !Number.isInteger(value.total) ||
    value.total < 0 ||
    typeof value.page !== "number" ||
    !Number.isInteger(value.page) ||
    value.page < 1 ||
    typeof value.limit !== "number" ||
    !Number.isInteger(value.limit) ||
    value.limit < 1 ||
    typeof value.hasMore !== "boolean"
  )
    throw new Error("Contrato do relatório inválido");
  const items = value.items.map((item) => {
    if (
      !record(item) ||
      !only(item, keys) ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      !REPORT_STATUSES.includes(item.status as ReportStatus) ||
      !REPORT_PRIORITIES.includes(item.priority as ReportPriority) ||
      !instant(item.issuedAt) ||
      !nullableDate(item.plannedEndDate) ||
      !(item.completedAt === null || instant(item.completedAt)) ||
      !nullableString(item.assigneeId) ||
      !nullableString(item.assigneeName) ||
      !nullableString(item.requisitionId) ||
      !(item.requisitionNumber === null || Number.isInteger(item.requisitionNumber)) ||
      !nullableString(item.requisitionTitle) ||
      !(
        item.estimatedHours === null ||
        (typeof item.estimatedHours === "number" && Number.isFinite(item.estimatedHours))
      ) ||
      typeof item.workedHours !== "number" ||
      !Number.isFinite(item.workedHours) ||
      item.workedHours < 0
    )
      throw new Error("Item do relatório inválido");
    return item as unknown as TaskReportItem;
  });
  return { ...value, items } as unknown as TaskReport;
}
