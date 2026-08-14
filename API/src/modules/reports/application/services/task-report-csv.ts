import type { TaskReportItem } from "@/modules/reports/application/read-models/task-report";

const headers = [
  "status",
  "priority",
  "title",
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
];

function escapeCsv(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function taskReportToCsv(items: readonly TaskReportItem[]): string {
  return `${[
    headers,
    ...items.map((item) => [
      item.status,
      item.priority,
      item.title,
      item.issuedAt,
      item.plannedEndDate,
      item.completedAt,
      item.assigneeId,
      item.assigneeName,
      item.requisitionId,
      item.requisitionNumber,
      item.requisitionTitle,
      item.estimatedHours,
      item.workedHours,
    ]),
  ]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n")}\r\n`;
}
