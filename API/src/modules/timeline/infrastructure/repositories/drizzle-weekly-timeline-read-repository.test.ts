import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import { companies, memberships, tasks, users } from "@/infrastructure/database/schema";
import { DrizzleWeeklyTimelineReadRepository } from "@/modules/timeline/infrastructure/repositories/drizzle-weekly-timeline-read-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "33333333-3333-4333-8333-333333333333";
const USER_INACTIVE = "44444444-4444-4444-8444-444444444444";

describe.skipIf(!available)("DrizzleWeeklyTimelineReadRepository", () => {
  let db: Database;
  let repository: DrizzleWeeklyTimelineReadRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleWeeklyTimelineReadRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE tasks, memberships, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A" },
      { id: COMPANY_B, name: "Tenant B" },
    ]);
    await db.insert(users).values([
      { id: USER_A, email: "a@example.com", name: "Ana", passwordHash: "hash" },
      {
        id: USER_INACTIVE,
        email: "inactive@example.com",
        name: "Inativo",
        passwordHash: "hash",
        isActive: false,
      },
    ]);
    await db.insert(memberships).values([
      { companyId: COMPANY_A, userId: USER_A, position: "GESTOR" },
      { companyId: COMPANY_A, userId: USER_INACTIVE, position: "GESTOR" },
      { companyId: COMPANY_B, userId: USER_A, position: "GESTOR" },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("isola tenant, limita a semana e retorna somente assignees visíveis", async () => {
    await db.insert(tasks).values([
      {
        id: "55555555-5555-4555-8555-555555555555",
        companyId: COMPANY_A,
        title: "Dentro",
        priority: "HIGH",
        status: "PAUSED",
        assigneeId: USER_A,
        startDate: "2026-08-10",
        plannedEndDate: "2026-08-16",
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        companyId: COMPANY_A,
        title: "Sem data",
        priority: "LOW",
        status: "TODO",
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        companyId: COMPANY_A,
        title: "Fora",
        startDate: "2026-08-17",
        plannedEndDate: "2026-08-20",
      },
      {
        id: "88888888-8888-4888-8888-888888888888",
        companyId: COMPANY_B,
        title: "Outro tenant",
        startDate: "2026-08-10",
        plannedEndDate: "2026-08-12",
      },
    ]);

    const result = await repository.findWeekly({
      companyId: COMPANY_A,
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
    });

    expect(result.tasks.map((task) => task.title)).toEqual(["Dentro", "Sem data"]);
    expect(result.tasks[0]).toMatchObject({
      companyId: COMPANY_A,
      requisitionId: null,
      description: null,
      assigneeId: USER_A,
      completedAt: null,
    });
    expect(result.assignees).toEqual([{ id: USER_A, name: "Ana" }]);
  });

  it("aplica filtros e inclui pontos e intervalos invertidos como candidatos", async () => {
    await db.insert(tasks).values([
      {
        companyId: COMPANY_A,
        title: "Ponto",
        priority: "HIGH",
        status: "TODO",
        assigneeId: USER_A,
        plannedEndDate: "2026-08-12",
      },
      {
        companyId: COMPANY_A,
        title: "Invertida",
        priority: "HIGH",
        status: "TODO",
        assigneeId: USER_A,
        startDate: "2026-08-14",
        plannedEndDate: "2026-08-11",
      },
      {
        companyId: COMPANY_A,
        title: "Outra prioridade",
        priority: "LOW",
        status: "TODO",
        assigneeId: USER_A,
      },
    ]);

    const result = await repository.findWeekly({
      companyId: COMPANY_A,
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
      assigneeId: USER_A,
      status: "TODO",
      priority: "HIGH",
    });

    expect(result.tasks.map((task) => task.title)).toEqual(["Invertida", "Ponto"]);
    expect(result.assignees).toEqual([{ id: USER_A, name: "Ana" }]);
  });
});
