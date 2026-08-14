import { describe, expect, it } from "vitest";

import { Company } from "@/modules/companies/domain/entities/company";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import type { NotificationDispatcher } from "@/modules/notifications/application/ports/notification-dispatcher";
import type { NotificationEvent } from "@/modules/notifications/domain/notification-event";
import { Release } from "@/modules/releases/domain/entities/release";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { buildTestModules, type TestModules } from "@/test/modules-test-helper";

const COMPANY_ID = "10000000-0000-4000-8000-000000000001";
const ACTOR_ID = "20000000-0000-4000-8000-000000000001";
const RESPONSIBLE_ID = "20000000-0000-4000-8000-000000000002";
const VERSION_ID = "30000000-0000-4000-8000-000000000001";

const actor: AuthenticatedUser = {
  userId: ACTOR_ID,
  companyId: COMPANY_ID,
  permissions: [
    "tasks.create",
    "tasks.update",
    "kanban.manage",
    "requisitions.create",
    "requisitions.update",
    "releases.manage",
  ],
};

class FakeDispatcher implements NotificationDispatcher {
  readonly events: NotificationEvent[] = [];
  onHandle?: (event: NotificationEvent) => Promise<void>;

  async handle(event: NotificationEvent): Promise<void> {
    this.events.push(event);
    await this.onHandle?.(event);
  }
}

async function seed(modules: TestModules): Promise<void> {
  await modules.repositories.companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
  await modules.repositories.memberships.create(
    Membership.create({ companyId: COMPANY_ID, userId: ACTOR_ID, position: "GESTOR" }),
  );
  await modules.repositories.memberships.create(
    Membership.create({
      companyId: COMPANY_ID,
      userId: RESPONSIBLE_ID,
      position: "DESENVOLVEDOR",
    }),
  );
}

describe("notification source use cases", () => {
  it("emite os cinco eventos após persistência, para os destinatários corretos e sem no-op", async () => {
    const dispatcher = new FakeDispatcher();
    const modules = buildTestModules(dispatcher);
    await seed(modules);
    const persistedAtDispatch: boolean[] = [];
    dispatcher.onHandle = async (event) => {
      const entityId = (event.data?.taskId ?? event.data?.requisitionId ?? event.data?.releaseId) as
        | string
        | undefined;
      if (event.eventType.startsWith("TASK")) {
        persistedAtDispatch.push(
          (await modules.repositories.tasks.findById(COMPANY_ID, entityId as string)) !== null,
        );
      } else if (event.eventType.startsWith("REQUISITION")) {
        persistedAtDispatch.push(
          (await modules.repositories.requisitions.findById(entityId as string)) !== null,
        );
      } else {
        persistedAtDispatch.push(
          (await modules.repositories.releases.findById(entityId as string))?.status ===
            "PUBLISHED",
        );
      }
    };

    const task = await modules.tasks.create.execute({
      actor,
      data: { title: "Implementar M16", assigneeId: RESPONSIBLE_ID },
    });
    await modules.tasks.update.execute({
      actor,
      taskId: task.id,
      changes: { title: "Implementar M16 sem regressão" },
    });
    expect(dispatcher.events).toHaveLength(1);
    await modules.tasks.transition.execute({
      actor,
      taskId: task.id,
      status: "IN_PROGRESS",
      occurredAt: new Date("2026-08-14T10:00:00Z"),
    });

    const requisition = await modules.requisitions.create.execute({
      actor,
      data: { title: "Requisição M16", responsibleId: RESPONSIBLE_ID },
    });
    await modules.requisitions.update.execute({
      actor,
      requisitionId: requisition.id,
      changes: { title: "Requisição M16 revisada" },
    });
    expect(dispatcher.events).toHaveLength(3);
    await modules.requisitions.update.execute({
      actor,
      requisitionId: requisition.id,
      changes: { deliveredAt: new Date("2026-08-14T11:00:00Z") },
    });

    const release = Release.create({
      companyId: COMPANY_ID,
      systemVersionId: VERSION_ID,
      versionLabel: "1.0.0",
      createdBy: ACTOR_ID,
    });
    await modules.repositories.releases.create(release);
    await modules.releases.publishRelease.execute({
      actor,
      releaseId: release.id,
      data: { artifactName: "orbis.tgz", artifactLocation: "https://example.test/orbis.tgz" },
    });

    expect(dispatcher.events.map((event) => event.eventType)).toEqual([
      "TASK_ASSIGNED",
      "TASK_STATUS_CHANGED",
      "REQUISITION_ASSIGNED",
      "REQUISITION_COMPLETED",
      "RELEASE_PUBLISHED",
    ]);
    expect(dispatcher.events.map((event) => event.recipientIds)).toEqual([
      [RESPONSIBLE_ID],
      [RESPONSIBLE_ID],
      [RESPONSIBLE_ID],
      [RESPONSIBLE_ID],
      undefined,
    ]);
    expect(dispatcher.events[3]?.recipientIds).not.toContain(ACTOR_ID);
    expect(persistedAtDispatch).toEqual([true, true, true, true, true]);
  });

  it("ignora falha do dispatcher sem alterar output nem persistência", async () => {
    const dispatcher: NotificationDispatcher = {
      async handle() {
        throw new Error("dispatcher indisponível");
      },
    };
    const modules = buildTestModules(dispatcher);
    await seed(modules);

    const output = await modules.tasks.create.execute({
      actor,
      data: { title: "Persistida apesar da falha", assigneeId: RESPONSIBLE_ID },
    });

    expect(output).toMatchObject({
      title: "Persistida apesar da falha",
      assigneeId: RESPONSIBLE_ID,
    });
    expect(await modules.repositories.tasks.findById(COMPANY_ID, output.id)).not.toBeNull();
  });
});
