import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import {
  companies,
  notificationPreferences,
  notifications,
  users,
} from "@/infrastructure/database/schema";
import { Notification } from "@/modules/notifications/domain/entities/notification";
import { NotificationPreference } from "@/modules/notifications/domain/entities/notification-preference";
import { DrizzleNotificationPreferenceRepository } from "@/modules/notifications/infrastructure/repositories/drizzle-notification-preference-repository";
import { DrizzleNotificationRepository } from "@/modules/notifications/infrastructure/repositories/drizzle-notification-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "10000000-0000-4000-8000-000000000001";
const COMPANY_B = "10000000-0000-4000-8000-000000000002";
const USER_A = "20000000-0000-4000-8000-000000000001";
const USER_B = "20000000-0000-4000-8000-000000000002";

function notification(
  id: string,
  companyId: string,
  userId: string,
  createdAt: string,
  eventId: string | null = null,
) {
  return Notification.restore({
    id,
    companyId,
    userId,
    eventId,
    type: "TASK_ASSIGNED",
    title: id,
    body: null,
    readAt: null,
    data: { id },
    createdAt: new Date(createdAt),
  });
}

describe.skipIf(!available).sequential("notification repositories PostgreSQL", () => {
  let db: Database;
  let notificationRepository: DrizzleNotificationRepository;
  let preferenceRepository: DrizzleNotificationPreferenceRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    notificationRepository = new DrizzleNotificationRepository(db);
    preferenceRepository = new DrizzleNotificationPreferenceRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC" },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC" },
    ]);
    await db.insert(users).values([
      { id: USER_A, email: "notifications-a@example.com", name: "User A", passwordHash: "hash" },
      { id: USER_B, email: "notifications-b@example.com", name: "User B", passwordHash: "hash" },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("aplica a migration final com company obrigatório, sem email, event_id e índices", async () => {
    const columns = await db.execute<{
      table_name: string;
      column_name: string;
      is_nullable: string;
    }>(sql`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('notifications', 'notification_preferences')
    `);
    const preferenceColumns = columns.filter(
      (row) => row.table_name === "notification_preferences",
    );
    expect(preferenceColumns).toContainEqual(
      expect.objectContaining({ column_name: "company_id", is_nullable: "NO" }),
    );
    expect(preferenceColumns.some((row) => row.column_name === "email_enabled")).toBe(false);
    expect(columns).toContainEqual(
      expect.objectContaining({ table_name: "notifications", column_name: "event_id" }),
    );

    const indexes = await db.execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('notifications', 'notification_preferences')
    `);
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "notification_preferences_user_company_event_unique",
        "notifications_company_user_created_id_idx",
        "notifications_company_user_unread_idx",
        "notifications_company_user_event_unique",
      ]),
    );
  });

  it("cria, ordena, pagina, conta não lidas e marca leitura de forma idempotente", async () => {
    const older = notification(
      "30000000-0000-4000-8000-000000000001",
      COMPANY_A,
      USER_A,
      "2026-08-14T10:00:00Z",
    );
    const newestLowerId = notification(
      "30000000-0000-4000-8000-000000000002",
      COMPANY_A,
      USER_A,
      "2026-08-14T11:00:00Z",
    );
    const newestHigherId = notification(
      "30000000-0000-4000-8000-000000000003",
      COMPANY_A,
      USER_A,
      "2026-08-14T11:00:00Z",
    );
    await notificationRepository.create(older);
    await notificationRepository.create(newestLowerId);
    await notificationRepository.create(newestHigherId);

    const page = await notificationRepository.list(COMPANY_A, USER_A, 2);
    expect(page.items.map((item) => item.id)).toEqual([newestHigherId.id, newestLowerId.id]);
    expect(page).toMatchObject({ unreadCount: 3, hasMore: true });

    const persisted = await notificationRepository.findById(COMPANY_A, USER_A, older.id);
    persisted?.markRead(new Date("2026-08-14T12:00:00Z"));
    await notificationRepository.update(persisted as Notification);
    const readAt = (await notificationRepository.findById(COMPANY_A, USER_A, older.id))?.readAt;
    persisted?.markRead(new Date("2026-08-14T13:00:00Z"));
    await notificationRepository.update(persisted as Notification);
    expect((await notificationRepository.findById(COMPANY_A, USER_A, older.id))?.readAt).toEqual(
      readAt,
    );
    expect((await notificationRepository.list(COMPANY_A, USER_A, 10)).unreadCount).toBe(2);
  });

  it("isola por tenant/usuário e deduplica eventId por destinatário", async () => {
    const eventId = "40000000-0000-4000-8000-000000000001";
    const own = notification(
      "30000000-0000-4000-8000-000000000001",
      COMPANY_A,
      USER_A,
      "2026-08-14T10:00:00Z",
      eventId,
    );
    await notificationRepository.create(own);
    await notificationRepository.create(
      notification(
        "30000000-0000-4000-8000-000000000002",
        COMPANY_A,
        USER_A,
        "2026-08-14T11:00:00Z",
        eventId,
      ),
    );
    await notificationRepository.create(
      notification(
        "30000000-0000-4000-8000-000000000003",
        COMPANY_A,
        USER_B,
        "2026-08-14T11:00:00Z",
        eventId,
      ),
    );
    await notificationRepository.create(
      notification(
        "30000000-0000-4000-8000-000000000004",
        COMPANY_B,
        USER_A,
        "2026-08-14T11:00:00Z",
        eventId,
      ),
    );

    expect((await notificationRepository.list(COMPANY_A, USER_A, 10)).items).toHaveLength(1);
    expect((await notificationRepository.list(COMPANY_A, USER_B, 10)).items).toHaveLength(1);
    expect((await notificationRepository.list(COMPANY_B, USER_A, 10)).items).toHaveLength(1);
    expect(await notificationRepository.findById(COMPANY_A, USER_B, own.id)).toBeNull();
    expect(await notificationRepository.findById(COMPANY_B, USER_A, own.id)).toBeNull();
  });

  it("faz upsert de preferência no escopo user/company/event", async () => {
    const preference = NotificationPreference.create({
      userId: USER_A,
      companyId: COMPANY_A,
      eventType: "TASK_ASSIGNED",
      inAppEnabled: true,
    });
    await preferenceRepository.upsert(preference);
    preference.setInAppEnabled(false);
    await preferenceRepository.upsert(preference);
    await preferenceRepository.upsert(
      NotificationPreference.create({
        userId: USER_A,
        companyId: COMPANY_B,
        eventType: "TASK_ASSIGNED",
        inAppEnabled: true,
      }),
    );
    await preferenceRepository.upsert(
      NotificationPreference.create({
        userId: USER_B,
        companyId: COMPANY_A,
        eventType: "TASK_ASSIGNED",
        inAppEnabled: true,
      }),
    );

    expect(await preferenceRepository.list(USER_A, COMPANY_A)).toHaveLength(1);
    expect(
      (await preferenceRepository.find(USER_A, COMPANY_A, "TASK_ASSIGNED"))?.inAppEnabled,
    ).toBe(false);
    expect(
      (await preferenceRepository.find(USER_A, COMPANY_B, "TASK_ASSIGNED"))?.inAppEnabled,
    ).toBe(true);
    expect(
      (await preferenceRepository.find(USER_B, COMPANY_A, "TASK_ASSIGNED"))?.inAppEnabled,
    ).toBe(true);
  });

  it("impõe NOT NULL e FKs de company/user nas duas tabelas", async () => {
    await expect(
      db.insert(notificationPreferences).values({
        userId: USER_A,
        companyId: "90000000-0000-4000-8000-000000000001",
        eventType: "TASK_ASSIGNED",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(notifications).values({
        companyId: COMPANY_A,
        userId: "90000000-0000-4000-8000-000000000002",
        type: "TASK_ASSIGNED",
        title: "FK",
      }),
    ).rejects.toThrow();
    await expect(
      db.execute(sql`
        INSERT INTO notification_preferences (user_id, event_type)
        VALUES (${USER_A}, 'TASK_ASSIGNED')
      `),
    ).rejects.toThrow();
  });
});
