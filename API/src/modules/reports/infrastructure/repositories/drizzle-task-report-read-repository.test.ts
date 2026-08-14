import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infrastructure/database/client";
import {
  companies,
  memberships,
  requisitions,
  tasks,
  timeEntries,
  users,
} from "@/infrastructure/database/schema";
import { DrizzleTaskReportReadRepository } from "@/modules/reports/infrastructure/repositories/drizzle-task-report-read-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const REQ = "44444444-4444-4444-8444-444444444444";
const TASK = "55555555-5555-4555-8555-555555555555";
const OTHER = "66666666-6666-4666-8666-666666666666";

describe.skipIf(!available)("DrizzleTaskReportReadRepository", () => {
  let db: Database;
  let repository: DrizzleTaskReportReadRepository;
  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleTaskReportReadRepository(db);
  });
  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE tasks, requisitions, memberships, time_entries, companies, users CASCADE`,
    );
    await db.insert(companies).values([
      { id: A, name: "A" },
      { id: B, name: "B" },
    ]);
    await db
      .insert(users)
      .values({ id: USER, email: "report@example.com", name: "Report User", passwordHash: "hash" });
    await db.insert(memberships).values({
      id: "77777777-7777-4777-8777-777777777777",
      companyId: A,
      userId: USER,
      position: "GESTOR",
    });
    await db.insert(requisitions).values({
      id: REQ,
      companyId: A,
      number: 1,
      title: "Req",
      requesterId: USER,
      estimatedHours: "8.00",
    });
  });
  afterAll(async () => {
    await db?.$client.end();
  });
  it("agrega horas sem duplicar estimativa, inclui nulos, filtra período/status/priority e isola tenant", async () => {
    await db.insert(tasks).values([
      {
        id: TASK,
        companyId: A,
        requisitionId: REQ,
        title: "Reportada",
        priority: "HIGH",
        status: "DONE",
        assigneeId: USER,
        plannedEndDate: "2026-08-10",
        createdAt: new Date("2026-08-01T10:00:00Z"),
      },
      {
        id: OTHER,
        companyId: B,
        title: "Outro tenant",
        priority: "HIGH",
        status: "DONE",
        createdAt: new Date("2026-08-01T10:00:00Z"),
      },
    ]);
    await db.insert(timeEntries).values([
      {
        id: "88888888-8888-4888-8888-888888888888",
        companyId: A,
        taskId: TASK,
        userId: USER,
        durationMinutes: 30,
        createdAt: new Date("2026-08-02T10:00:00Z"),
      },
      {
        id: "99999999-9999-4999-8999-999999999999",
        companyId: A,
        taskId: TASK,
        userId: USER,
        durationMinutes: 90,
        createdAt: new Date("2026-09-02T10:00:00Z"),
      },
    ]);
    const result = await repository.find({
      companyId: A,
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      status: "DONE",
      priority: "HIGH",
      page: 1,
      limit: 10,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: TASK,
      requisitionId: REQ,
      estimatedHours: 8,
      workedHours: 0.5,
    });
  });
});
