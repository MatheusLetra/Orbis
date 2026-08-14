import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/modules/tasks/domain/entities/task";

export const taskReportQuerySchema = z
  .object({
    periodStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "periodStart inválido")
      .optional(),
    periodEnd: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "periodEnd inválido")
      .optional(),
    requisitionId: z.string().uuid("requisitionId inválido").optional(),
    employeeId: z.string().uuid("employeeId inválido").optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.periodStart === undefined) !== (value.periodEnd === undefined)) {
      context.addIssue({
        code: "custom",
        message: "periodStart e periodEnd devem ser informados juntos",
      });
      return;
    }
    if (value.periodStart && value.periodEnd && value.periodStart > value.periodEnd) {
      context.addIssue({ code: "custom", message: "O período informado está invertido" });
    }
    for (const field of ["periodStart", "periodEnd"] as const) {
      const valueForDate = value[field];
      if (!valueForDate) continue;
      const date = new Date(`${valueForDate}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== valueForDate) {
        context.addIssue({ code: "custom", path: [field], message: `${field} inválido` });
      }
    }
  });

export type TaskReportQueryInput = z.infer<typeof taskReportQuerySchema>;

export const EXPORT_LIMIT = 10_000;
