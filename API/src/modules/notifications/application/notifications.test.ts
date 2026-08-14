import { describe, expect, it } from "vitest";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { NotificationHandler } from "@/modules/notifications/application/services/notification-handler";
import { PreferenceResolver } from "@/modules/notifications/application/services/preference-resolver";
import { GetNotificationPreferences } from "@/modules/notifications/application/use-cases/get-notification-preferences";
import { ListNotifications } from "@/modules/notifications/application/use-cases/list-notifications";
import { MarkNotificationRead } from "@/modules/notifications/application/use-cases/mark-notification-read";
import { UpdateNotificationPreference } from "@/modules/notifications/application/use-cases/update-notification-preference";
import { Notification } from "@/modules/notifications/domain/entities/notification";
import { NotificationPreference } from "@/modules/notifications/domain/entities/notification-preference";
import type { NotificationEventType } from "@/modules/notifications/domain/notification-event";
import type { NotificationPreferenceRepository } from "@/modules/notifications/domain/repositories/notification-preference-repository";
import type {
  NotificationPage,
  NotificationRepository,
} from "@/modules/notifications/domain/repositories/notification-repository";
import { MembershipReleaseRecipientResolver } from "@/modules/notifications/infrastructure/resolvers/membership-release-recipient-resolver";
import { User } from "@/modules/users/domain/entities/user";
import { InMemoryMembershipRepository, InMemoryUserRepository } from "@/test/fakes/identity-fakes";

const COMPANY_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000002";
const ACTOR_ID = "10000000-0000-4000-8000-000000000003";

class InMemoryNotifications implements NotificationRepository {
  items: Notification[] = [];
  async create(item: Notification) {
    this.items.push(item);
    return item;
  }
  async list(companyId: string, userId: string, limit: number): Promise<NotificationPage> {
    const all = this.items
      .filter((item) => item.companyId === companyId && item.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    return {
      items: all.slice(0, limit),
      unreadCount: all.filter((item) => item.readAt === null).length,
      hasMore: all.length > limit,
    };
  }
  async findById(companyId: string, userId: string, id: string) {
    return (
      this.items.find(
        (item) => item.companyId === companyId && item.userId === userId && item.id === id,
      ) ?? null
    );
  }
  async update(item: Notification) {
    return item;
  }
}

class InMemoryPreferences implements NotificationPreferenceRepository {
  items: NotificationPreference[] = [];
  async list(userId: string, companyId: string) {
    return this.items.filter((item) => item.userId === userId && item.companyId === companyId);
  }
  async find(userId: string, companyId: string, eventType: NotificationEventType) {
    return (
      this.items.find(
        (item) =>
          item.userId === userId && item.companyId === companyId && item.eventType === eventType,
      ) ?? null
    );
  }
  async upsert(item: NotificationPreference) {
    this.items = this.items.filter(
      (current) =>
        !(
          current.userId === item.userId &&
          current.companyId === item.companyId &&
          current.eventType === item.eventType
        ),
    );
    this.items.push(item);
    return item;
  }
}

async function setup() {
  const memberships = new InMemoryMembershipRepository();
  const users = new InMemoryUserRepository();
  const notifications = new InMemoryNotifications();
  const preferences = new InMemoryPreferences();
  await memberships.create(
    Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "DESENVOLVEDOR" }),
  );
  await users.create(
    User.create({ email: "user@orbis.test", name: "User", passwordHash: "hash" }, USER_ID),
  );
  const access = new MembershipAccessService(memberships);
  const handler = new NotificationHandler(
    notifications,
    memberships,
    users,
    new PreferenceResolver(preferences),
    new MembershipReleaseRecipientResolver(memberships, users),
  );
  return { memberships, users, notifications, preferences, access, handler };
}

describe("notifications", () => {
  it("materializa os cinco defaults e persiste alteração tenant-scoped", async () => {
    const { preferences, access } = await setup();
    const actor = { userId: USER_ID, companyId: COMPANY_ID, permissions: [] as const };
    const get = new GetNotificationPreferences(preferences, access);
    expect(await get.execute({ actor })).toEqual({
      items: [
        { eventType: "TASK_ASSIGNED", inAppEnabled: true },
        { eventType: "TASK_STATUS_CHANGED", inAppEnabled: true },
        { eventType: "REQUISITION_ASSIGNED", inAppEnabled: true },
        { eventType: "REQUISITION_COMPLETED", inAppEnabled: true },
        { eventType: "RELEASE_PUBLISHED", inAppEnabled: true },
      ],
    });
    const update = new UpdateNotificationPreference(preferences, access);
    expect(
      await update.execute({ actor, data: { eventType: "TASK_ASSIGNED", inAppEnabled: false } }),
    ).toEqual({ eventType: "TASK_ASSIGNED", inAppEnabled: false });
    expect((await get.execute({ actor })).items[0]).toEqual({
      eventType: "TASK_ASSIGNED",
      inAppEnabled: false,
    });
  });

  it("handler exclui ator, membership/user inativos e preferência desabilitada", async () => {
    const { handler, notifications, preferences } = await setup();
    await preferences.upsert(
      NotificationPreference.create({
        userId: USER_ID,
        companyId: COMPANY_ID,
        eventType: "TASK_ASSIGNED",
        inAppEnabled: false,
      }),
    );
    const event = {
      eventType: "TASK_ASSIGNED" as const,
      companyId: COMPANY_ID,
      actorId: ACTOR_ID,
      recipientIds: [USER_ID],
      title: "Tarefa atribuída",
      body: null,
      data: null,
    };
    await handler.handle(event);
    expect(notifications.items).toHaveLength(0);
    preferences.items = [];
    await handler.handle({ ...event, recipientIds: [ACTOR_ID, USER_ID, USER_ID] });
    expect(notifications.items.map((item) => item.userId)).toEqual([USER_ID]);
  });

  it("lista com unread global/hasMore e leitura idempotente protegida por tenant e usuário", async () => {
    const { notifications, access } = await setup();
    const actor = { userId: USER_ID, companyId: COMPANY_ID, permissions: [] as const };
    notifications.items.push(
      Notification.create({
        companyId: COMPANY_ID,
        userId: USER_ID,
        eventId: null,
        type: "TASK_ASSIGNED",
        title: "A",
        body: null,
        data: null,
      }),
      Notification.create({
        companyId: COMPANY_ID,
        userId: USER_ID,
        eventId: null,
        type: "TASK_ASSIGNED",
        title: "B",
        body: null,
        data: null,
      }),
    );
    const page = await new ListNotifications(notifications, access).execute({ actor, limit: 1 });
    expect(page).toMatchObject({ unreadCount: 2, hasMore: true });
    expect(page.items).toHaveLength(1);
    const mark = new MarkNotificationRead(notifications, access);
    const first = await mark.execute({ actor, notificationId: notifications.items[0].id });
    const second = await mark.execute({ actor, notificationId: notifications.items[0].id });
    expect(first.readAt).toBe(second.readAt);
    await expect(
      mark.execute({ actor, notificationId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("release recipients usa permissões explícitas ou preset, nunca mistura ambos", async () => {
    const { memberships, users } = await setup();
    const explicitId = crypto.randomUUID();
    const explicit = Membership.create({
      companyId: COMPANY_ID,
      userId: explicitId,
      position: "GESTOR",
    });
    explicit.changePermissions(["tasks.read"]);
    await memberships.create(explicit);
    await users.create(
      User.create(
        { email: "explicit@orbis.test", name: "Explicit", passwordHash: "hash" },
        explicitId,
      ),
    );
    const resolver = new MembershipReleaseRecipientResolver(memberships, users);
    expect(await resolver.resolve(COMPANY_ID)).toEqual([USER_ID]);
  });
});
