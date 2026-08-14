import type { TimelineTask, WeeklyTimeline } from "./timeline-contracts";

export const timelineTask: TimelineTask = {
  id: "task-a",
  companyId: "company-a",
  requisitionId: null,
  title: "Publicar versão",
  description: "Preparar a publicação semanal",
  priority: "HIGH",
  status: "PAUSED",
  assigneeId: "user-a",
  startDate: "2026-08-17",
  plannedEndDate: "2026-08-18",
  completedAt: null,
  isOverdue: true,
  isPaused: true,
};

export const weeklyTimeline: WeeklyTimeline = {
  companyId: "company-a",
  weekStart: "2026-08-17",
  weekEnd: "2026-08-23",
  days: ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"].map(
    (date, index) => ({ date, isBusinessDay: true, tasks: index === 0 ? [timelineTask] : [] }),
  ),
  undatedTasks: [
    {
      ...timelineTask,
      id: "task-b",
      title: "Revisar backlog",
      startDate: null,
      plannedEndDate: null,
      isPaused: false,
      isOverdue: false,
    },
  ],
  overdueTasks: [
    {
      ...timelineTask,
      id: "task-c",
      title: "Corrigir pendência",
      startDate: "2026-08-10",
      plannedEndDate: "2026-08-14",
      isPaused: false,
    },
  ],
  weekendTasks: [
    {
      ...timelineTask,
      id: "task-d",
      title: "Acompanhar publicação",
      startDate: "2026-08-22",
      plannedEndDate: "2026-08-23",
      isOverdue: false,
      isPaused: false,
    },
  ],
  assignees: [{ id: "user-a", name: "Ana" }],
};
