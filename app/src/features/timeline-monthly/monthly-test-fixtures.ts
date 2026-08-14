import type { MonthlyTimeline } from "./monthly-contracts";

export const monthlyTimeline: MonthlyTimeline = {
  companyId: "company-a",
  period: "2026-08",
  items: [
    {
      requisitionId: "req-a",
      number: 42,
      title: "Preparar proposta",
      priority: "HIGH",
      assigneeId: "user-a",
      startDate: "2026-08-03",
      plannedDeliveryDate: "2026-08-12",
      deliveredAt: null,
      estimatedHours: 8,
      isOverdue: true,
      deliveredOnTime: false,
    },
  ],
  undatedItems: [],
  indicators: { totalRequisitions: 1, estimatedHours: 8, deliveredOnTime: 0, overdue: 1 },
};
