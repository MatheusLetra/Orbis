import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditLog } from "@/modules/audit/domain/entities/audit-log";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";
import { DrizzleAuditLogRepository } from "./drizzle-audit-log-repository";

const companyId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const available = await isTestDatabaseAvailable();

describe.skipIf(!available)("DrizzleAuditLogRepository PostgreSQL", () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let repository: DrizzleAuditLogRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    await db.execute(sql`TRUNCATE audit_logs, companies, users CASCADE`);
    await db.execute(sql`insert into companies (id, name) values (${companyId}, 'Audit')`);
    await db.execute(
      sql`insert into users (id, email, name, password_hash) values (${userId}, 'audit@test', 'Audit', 'hash')`,
    );
    repository = new DrizzleAuditLogRepository(db);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("persiste, ordena e pagina sem cruzar tenant", async () => {
    const first = AuditLog.create({
      companyId,
      actorUserId: userId,
      action: "COMPANY_UPDATED",
      entityType: "COMPANY",
      entityId: companyId,
      metadata: { changedFields: ["name"] },
      createdAt: new Date("2026-08-14T12:00:00.000Z"),
    });
    const second = AuditLog.create({
      companyId,
      actorUserId: userId,
      action: "TASK_STATUS_CHANGED",
      entityType: "TASK",
      entityId: userId,
      metadata: { fromStatus: "TODO", toStatus: "DONE" },
      createdAt: new Date("2026-08-14T13:00:00.000Z"),
    });
    await repository.create(first);
    await repository.create(second);
    const page = await repository.list(companyId, {}, 1, null);
    expect(page.items[0]?.props.id).toBe(second.props.id);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTypeOf("string");
    const firstPageItem = page.items[0];
    if (!firstPageItem) throw new Error("A primeira página deveria possuir um item");
    const next = await repository.list(companyId, {}, 1, {
      createdAt: firstPageItem.props.createdAt,
      id: firstPageItem.props.id,
    });
    expect(next.items[0]?.props.id).toBe(first.props.id);
  });
});
