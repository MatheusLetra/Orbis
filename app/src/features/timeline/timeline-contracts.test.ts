import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  isCalendarDate,
  isValidWeekStart,
  parseWeeklyTimeline,
} from "./timeline-contracts";
import { weeklyTimeline } from "./timeline-test-fixtures";

describe("timeline contracts", () => {
  it("aceita a semana normalizada e preserva datas de calendário", () => {
    expect(parseWeeklyTimeline(weeklyTimeline)).toEqual(weeklyTimeline);
    expect(addCalendarDays("2026-03-02", -1)).toBe("2026-03-01");
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isValidWeekStart("2026-08-17")).toBe(true);
    expect(isValidWeekStart("2026-08-18")).toBe(false);
  });

  it.each([
    null,
    { ...weeklyTimeline, extra: true },
    { ...weeklyTimeline, weekStart: "2026-08-18" },
    { ...weeklyTimeline, weekEnd: "2026-08-21" },
    { ...weeklyTimeline, days: weeklyTimeline.days.slice(1) },
    {
      ...weeklyTimeline,
      days: [{ ...weeklyTimeline.days[0], isBusinessDay: false }, ...weeklyTimeline.days.slice(1)],
    },
    { ...weeklyTimeline, assignees: [{ id: "user-a", name: "Ana", role: "dev" }] },
    {
      ...weeklyTimeline,
      undatedTasks: [{ ...weeklyTimeline.undatedTasks[0], companyId: "company-b" }],
    },
    {
      ...weeklyTimeline,
      undatedTasks: [{ ...weeklyTimeline.undatedTasks[0], completedAt: "2026-08-20" }],
    },
    {
      ...weeklyTimeline,
      undatedTasks: [{ ...weeklyTimeline.undatedTasks[0], startDate: "2026-02-30" }],
    },
    { ...weeklyTimeline, undatedTasks: [{ ...weeklyTimeline.undatedTasks[0], unexpected: true }] },
    { ...weeklyTimeline, overdueTasks: undefined },
    { ...weeklyTimeline, weekendTasks: [{ ...weeklyTimeline.weekendTasks[0], unexpected: true }] },
    {
      ...weeklyTimeline,
      overdueTasks: [{ ...weeklyTimeline.overdueTasks[0], companyId: "company-b" }],
    },
  ])("rejeita resposta não estrita %#", (value) => {
    expect(() => parseWeeklyTimeline(value)).toThrow("Contrato da timeline semanal inválido");
  });
});
