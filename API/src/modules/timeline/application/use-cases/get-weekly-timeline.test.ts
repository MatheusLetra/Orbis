import { describe, expect, it } from "vitest";

import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { Task } from "@/modules/tasks/domain/entities/task";
import { buildTestModules } from "@/test/modules-test-helper";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function task(id: string, overrides: Partial<Parameters<typeof Task.restore>[0]>): Task {
  return Task.restore({
    id,
    companyId: COMPANY_ID,
    requisitionId: null,
    title: "Tarefa",
    description: null,
    priority: "MEDIUM",
    status: "TODO",
    assigneeId: null,
    startDate: null,
    plannedEndDate: null,
    completedAt: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  });
}

async function setup() {
  const modules = buildTestModules();
  await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
  await modules.repositories.memberships.create(
    Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "GESTOR" }),
  );
  return modules;
}

describe("GetWeeklyTimeline", () => {
  it("distribui intervalos e separa cada task em uma única categoria", async () => {
    const modules = await setup();
    await modules.repositories.tasks.create(
      task("33333333-3333-4333-8333-333333333333", {
        title: "Ponto por fim",
        description: "Detalhe",
        priority: "HIGH",
        status: "PAUSED",
        plannedEndDate: new Date("2026-08-12T00:00:00Z"),
      }),
    );
    await modules.repositories.tasks.create(
      task("44444444-4444-4444-8444-444444444444", {
        title: "Atrasada",
        plannedEndDate: new Date("2026-08-09T00:00:00Z"),
      }),
    );
    await modules.repositories.tasks.create(
      task("55555555-5555-4555-8555-555555555555", {
        title: "Invertida",
        startDate: new Date("2026-08-14T00:00:00Z"),
        plannedEndDate: new Date("2026-08-11T00:00:00Z"),
      }),
    );
    await modules.repositories.tasks.create(
      task("66666666-6666-4666-8666-666666666666", { title: "Sem datas" }),
    );
    await modules.repositories.tasks.create(
      task("77777777-7777-4777-8777-777777777777", {
        title: "Intervalo útil",
        startDate: new Date("2026-08-10T00:00:00Z"),
        plannedEndDate: new Date("2026-08-12T00:00:00Z"),
      }),
    );
    await modules.repositories.tasks.create(
      task("88888888-8888-4888-8888-888888888888", {
        title: "Sexta e sábado",
        startDate: new Date("2026-08-14T00:00:00Z"),
        plannedEndDate: new Date("2026-08-15T00:00:00Z"),
      }),
    );
    await modules.repositories.tasks.create(
      task("99999999-9999-4999-8999-999999999999", {
        title: "Fim de semana",
        startDate: new Date("2026-08-15T00:00:00Z"),
        plannedEndDate: new Date("2026-08-16T00:00:00Z"),
      }),
    );

    const result = await modules.timeline.getWeekly.execute({
      actor: { userId: USER_ID, companyId: COMPANY_ID, permissions: ["tasks.read"] },
      companyId: COMPANY_ID,
      weekStart: "2026-08-10",
    });

    expect(result).toMatchObject({
      companyId: COMPANY_ID,
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
      days: [
        { date: "2026-08-10", isBusinessDay: true },
        { date: "2026-08-11", isBusinessDay: true },
        { date: "2026-08-12", isBusinessDay: true },
        { date: "2026-08-13", isBusinessDay: true },
        { date: "2026-08-14", isBusinessDay: true },
      ],
    });
    expect(result.days.map((day) => day.tasks.map((item) => item.title))).toEqual([
      ["Intervalo útil"],
      ["Intervalo útil"],
      ["Intervalo útil", "Ponto por fim"],
      [],
      ["Sexta e sábado"],
    ]);
    expect(result.days[2]?.tasks[1]).toMatchObject({
      companyId: COMPANY_ID,
      requisitionId: null,
      description: "Detalhe",
      assigneeId: null,
      startDate: null,
      plannedEndDate: "2026-08-12",
      completedAt: null,
      isPaused: true,
    });
    expect(result.overdueTasks).toHaveLength(1);
    expect(result.overdueTasks[0]).toMatchObject({
      title: "Atrasada",
      startDate: null,
      plannedEndDate: "2026-08-09",
      isOverdue: true,
      isPaused: false,
    });
    expect(result.undatedTasks.map((item) => item.title)).toEqual(["Invertida", "Sem datas"]);
    expect(result.weekendTasks.map((item) => item.title)).toEqual(["Fim de semana"]);
    expect(result).not.toHaveProperty("tasks");
  });

  it("valida segunda-feira, filtros, permissão, membership e empresa ativa", async () => {
    const modules = await setup();
    const command = {
      actor: { userId: USER_ID, companyId: COMPANY_ID, permissions: ["tasks.read"] as const },
      companyId: COMPANY_ID,
      weekStart: "2026-08-10",
    };

    await expect(
      modules.timeline.getWeekly.execute({ ...command, weekStart: "2026-08-11" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      modules.timeline.getWeekly.execute({
        ...command,
        filters: { assigneeId: "inválido" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      modules.timeline.getWeekly.execute({
        ...command,
        actor: { ...command.actor, permissions: [] },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const membership = await modules.repositories.memberships.findByUserAndCompany(
      USER_ID,
      COMPANY_ID,
    );
    membership?.deactivate();
    if (membership) await modules.repositories.memberships.update(membership);
    await expect(modules.timeline.getWeekly.execute(command)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    membership?.reactivate();
    if (membership) await modules.repositories.memberships.update(membership);
    const company = await modules.repositories.companies.findById(COMPANY_ID);
    company?.deactivate();
    if (company) await modules.repositories.companies.update(company);
    await expect(modules.timeline.getWeekly.execute(command)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
