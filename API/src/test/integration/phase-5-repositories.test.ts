import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import {
  attachments,
  companies,
  memberships,
  requisitions,
  taskStatusHistory,
  tasks,
  users,
} from "@/infrastructure/database/schema";
import { Attachment } from "@/modules/attachments/domain/entities/attachment";
import { DrizzleAttachmentRepository } from "@/modules/attachments/infrastructure/repositories/drizzle-attachment-repository";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { Release } from "@/modules/releases/domain/entities/release";
import { DrizzleReleaseRepository } from "@/modules/releases/infrastructure/repositories/drizzle-release-repository";
import { DrizzleRequisitionAssigneeRepository } from "@/modules/requisitions/infrastructure/repositories/drizzle-requisition-assignee-repository";
import { DrizzleRequisitionRepository } from "@/modules/requisitions/infrastructure/repositories/drizzle-requisition-repository";
import { System } from "@/modules/systems/domain/entities/system";
import { DrizzleSystemRepository } from "@/modules/systems/infrastructure/repositories/drizzle-system-repository";
import { Task } from "@/modules/tasks/domain/entities/task";
import { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import { TimeEntry } from "@/modules/tasks/domain/entities/time-entry";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-repository";
import { DrizzleTaskStatusHistoryRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-status-history-repository";
import { DrizzleTimeEntryRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-time-entry-repository";
import { SystemVersion } from "@/modules/versions/domain/entities/system-version";
import { DrizzleSystemVersionRepository } from "@/modules/versions/infrastructure/repositories/drizzle-system-version-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();

const COMPANY_A = "10000000-0000-4000-8000-000000000001";
const COMPANY_B = "10000000-0000-4000-8000-000000000002";
const USER_A = "20000000-0000-4000-8000-000000000001";
const USER_B = "20000000-0000-4000-8000-000000000002";
const SYSTEM_A = "30000000-0000-4000-8000-000000000001";
const SYSTEM_B = "30000000-0000-4000-8000-000000000002";
const VERSION_A = "40000000-0000-4000-8000-000000000001";
const VERSION_B = "40000000-0000-4000-8000-000000000002";
const RELEASE_A = "50000000-0000-4000-8000-000000000001";
const RELEASE_B = "50000000-0000-4000-8000-000000000002";
const REQUISITION_A = "60000000-0000-4000-8000-000000000001";
const TASK_A = "70000000-0000-4000-8000-000000000001";
const TASK_B = "70000000-0000-4000-8000-000000000002";
const ATTACHMENT_A = "80000000-0000-4000-8000-000000000001";

const CREATED_AT = new Date("2026-08-14T10:00:00.000Z");

function buildSystem(
  id: string,
  companyId: string,
  name: string,
  description: string | null = null,
): System {
  return System.restore({
    id,
    companyId,
    name,
    description,
    isActive: true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
}

function buildVersion(
  id: string,
  companyId: string,
  systemId: string,
  version: string,
): SystemVersion {
  return SystemVersion.restore({
    id,
    companyId,
    systemId,
    version,
    isActive: true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
}

function buildRelease(
  id: string,
  companyId: string,
  systemVersionId: string,
  overrides: Partial<Parameters<typeof Release.restore>[0]> = {},
): Release {
  return Release.restore({
    id,
    companyId,
    systemVersionId,
    versionLabel: "1.0.0",
    channel: "STABLE",
    status: "DRAFT",
    artifactName: null,
    storageKey: null,
    checksum: null,
    sizeBytes: null,
    publishedAt: null,
    createdBy: USER_A,
    createdAt: CREATED_AT,
    ...overrides,
  });
}

function buildTask(
  id: string,
  companyId: string,
  overrides: Partial<Parameters<typeof Task.restore>[0]> = {},
): Task {
  return Task.restore({
    id,
    companyId,
    requisitionId: null,
    title: "Task sem vínculos",
    description: null,
    priority: "LOW",
    status: "TODO",
    assigneeId: null,
    startDate: null,
    plannedEndDate: null,
    completedAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  });
}

describe.skipIf(!available)("FASE 5 - repositories e mappers PostgreSQL", () => {
  let db: Database;
  let systemRepository: DrizzleSystemRepository;
  let versionRepository: DrizzleSystemVersionRepository;
  let releaseRepository: DrizzleReleaseRepository;
  let attachmentRepository: DrizzleAttachmentRepository;
  let membershipRepository: DrizzleMembershipRepository;
  let taskRepository: DrizzleTaskRepository;
  let historyRepository: DrizzleTaskStatusHistoryRepository;
  let timeEntryRepository: DrizzleTimeEntryRepository;
  let requisitionRepository: DrizzleRequisitionRepository;
  let assigneeRepository: DrizzleRequisitionAssigneeRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    systemRepository = new DrizzleSystemRepository(db);
    versionRepository = new DrizzleSystemVersionRepository(db);
    releaseRepository = new DrizzleReleaseRepository(db);
    attachmentRepository = new DrizzleAttachmentRepository(db);
    membershipRepository = new DrizzleMembershipRepository(db);
    taskRepository = new DrizzleTaskRepository(db);
    historyRepository = new DrizzleTaskStatusHistoryRepository(db);
    timeEntryRepository = new DrizzleTimeEntryRepository(db);
    requisitionRepository = new DrizzleRequisitionRepository(db);
    assigneeRepository = new DrizzleRequisitionAssigneeRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC" },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC" },
    ]);
    await db.insert(users).values([
      { id: USER_A, email: "phase5-a@example.com", name: "User A", passwordHash: "hash" },
      { id: USER_B, email: "phase5-b@example.com", name: "User B", passwordHash: "hash" },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  describe("SystemRepository/SystemMapper", () => {
    it("persiste null, atualiza estado e restaura datas", async () => {
      const system = await systemRepository.create(
        buildSystem(SYSTEM_A, COMPANY_A, "Orbis Core", null),
      );

      expect(system).toMatchObject({
        id: SYSTEM_A,
        companyId: COMPANY_A,
        description: null,
        isActive: true,
      });
      expect(system.createdAt).toBeInstanceOf(Date);

      system.changeDescription("  Sistema principal  ");
      system.deactivate();
      const updated = await systemRepository.update(system);

      expect(updated.description).toBe("Sistema principal");
      expect(updated.isActive).toBe(false);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it("isola nome e listagem por tenant, ordena e retorna null/vazio", async () => {
      await systemRepository.create(buildSystem(SYSTEM_A, COMPANY_A, "Zulu"));
      await systemRepository.create(buildSystem(SYSTEM_B, COMPANY_B, "Alpha"));
      await systemRepository.create(
        buildSystem("30000000-0000-4000-8000-000000000003", COMPANY_A, "Alpha"),
      );

      await expect(systemRepository.findByNameInCompany(COMPANY_B, "Zulu")).resolves.toBeNull();
      await expect(
        systemRepository.findById("30000000-0000-4000-8000-000000000099"),
      ).resolves.toBeNull();
      await expect(systemRepository.listByCompany(COMPANY_A)).resolves.toMatchObject([
        { name: "Alpha", companyId: COMPANY_A },
        { name: "Zulu", companyId: COMPANY_A },
      ]);
      await expect(
        systemRepository.listByCompany("10000000-0000-4000-8000-000000000099"),
      ).resolves.toEqual([]);
    });

    it("exclui o System", async () => {
      await systemRepository.create(buildSystem(SYSTEM_A, COMPANY_A, "Temporário"));
      await systemRepository.delete(SYSTEM_A);
      await expect(systemRepository.findById(SYSTEM_A)).resolves.toBeNull();
    });
  });

  describe("SystemVersionRepository/SystemVersionMapper", () => {
    beforeEach(async () => {
      await systemRepository.create(buildSystem(SYSTEM_A, COMPANY_A, "A"));
      await systemRepository.create(buildSystem(SYSTEM_B, COMPANY_B, "B"));
    });

    it("persiste, atualiza e restaura estado/datas", async () => {
      const version = await versionRepository.create(
        buildVersion(VERSION_A, COMPANY_A, SYSTEM_A, "1.0.0"),
      );
      version.changeVersion("1.1.0");
      version.deactivate();

      const updated = await versionRepository.update(version);

      expect(updated).toMatchObject({
        id: VERSION_A,
        companyId: COMPANY_A,
        systemId: SYSTEM_A,
        version: "1.1.0",
        isActive: false,
      });
      expect(updated.createdAt).toBeInstanceOf(Date);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it("isola por System, ordena e retorna null/vazio", async () => {
      await versionRepository.create(buildVersion(VERSION_A, COMPANY_A, SYSTEM_A, "2.0.0"));
      await versionRepository.create(
        buildVersion("40000000-0000-4000-8000-000000000003", COMPANY_A, SYSTEM_A, "1.0.0"),
      );
      await versionRepository.create(buildVersion(VERSION_B, COMPANY_B, SYSTEM_B, "1.0.0"));

      expect(
        (await versionRepository.listBySystem(SYSTEM_A)).map(({ version }) => version),
      ).toEqual(["1.0.0", "2.0.0"]);
      await expect(versionRepository.findVersionInSystem(SYSTEM_B, "2.0.0")).resolves.toBeNull();
      await expect(
        versionRepository.findById("40000000-0000-4000-8000-000000000099"),
      ).resolves.toBeNull();
      await expect(
        versionRepository.listBySystem("30000000-0000-4000-8000-000000000099"),
      ).resolves.toEqual([]);
    });

    it("exclui a SystemVersion", async () => {
      await versionRepository.create(buildVersion(VERSION_A, COMPANY_A, SYSTEM_A, "1.0.0"));
      await versionRepository.delete(VERSION_A);
      await expect(versionRepository.findById(VERSION_A)).resolves.toBeNull();
    });
  });

  describe("ReleaseRepository/ReleaseMapper", () => {
    beforeEach(async () => {
      await systemRepository.create(buildSystem(SYSTEM_A, COMPANY_A, "A"));
      await systemRepository.create(buildSystem(SYSTEM_B, COMPANY_B, "B"));
      await versionRepository.create(buildVersion(VERSION_A, COMPANY_A, SYSTEM_A, "1.0.0"));
      await versionRepository.create(buildVersion(VERSION_B, COMPANY_B, SYSTEM_B, "2.0.0"));
    });

    it("restaura DRAFT com artefato nulo e PUBLISHED com bigint/datas", async () => {
      const release = await releaseRepository.create(buildRelease(RELEASE_A, COMPANY_A, VERSION_A));

      expect(release).toMatchObject({
        channel: "STABLE",
        status: "DRAFT",
        artifactName: null,
        storageKey: null,
        checksum: null,
        sizeBytes: null,
        publishedAt: null,
      });

      release.publish({
        artifactName: "orbis.tar.gz",
        storageKey: "releases/orbis.tar.gz",
        checksum: "a".repeat(64),
        sizeBytes: 4_294_967_296,
      });
      const published = await releaseRepository.update(release);

      expect(published).toMatchObject({
        status: "PUBLISHED",
        artifactName: "orbis.tar.gz",
        storageKey: "releases/orbis.tar.gz",
        checksum: "a".repeat(64),
        sizeBytes: 4_294_967_296,
      });
      expect(published.publishedAt).toBeInstanceOf(Date);
      expect(published.createdAt).toBeInstanceOf(Date);
    });

    it("isola e ordena a listagem por tenant e retorna null/vazio", async () => {
      await releaseRepository.create(
        buildRelease(RELEASE_A, COMPANY_A, VERSION_A, {
          createdAt: new Date("2026-08-14T12:00:00Z"),
        }),
      );
      await releaseRepository.create(
        buildRelease("50000000-0000-4000-8000-000000000003", COMPANY_A, VERSION_A, {
          channel: "BETA",
          createdAt: new Date("2026-08-14T11:00:00Z"),
        }),
      );
      await releaseRepository.create(
        buildRelease(RELEASE_B, COMPANY_B, VERSION_B, { createdBy: USER_B }),
      );

      expect((await releaseRepository.listByCompany(COMPANY_A)).map(({ id }) => id)).toEqual([
        "50000000-0000-4000-8000-000000000003",
        RELEASE_A,
      ]);
      await expect(
        releaseRepository.findById("50000000-0000-4000-8000-000000000099"),
      ).resolves.toBeNull();
      await expect(
        releaseRepository.listByCompany("10000000-0000-4000-8000-000000000099"),
      ).resolves.toEqual([]);
    });

    it("exclui a Release", async () => {
      await releaseRepository.create(buildRelease(RELEASE_A, COMPANY_A, VERSION_A));
      await releaseRepository.delete(RELEASE_A);
      await expect(releaseRepository.findById(RELEASE_A)).resolves.toBeNull();
    });
  });

  describe("AttachmentRepository mapper adicional", () => {
    beforeEach(async () => {
      await db.insert(tasks).values({ id: TASK_A, companyId: COMPANY_A, title: "Owner" });
    });

    it("restaura LINK de Task com campos de arquivo nulos e respeita owner/tenant", async () => {
      const owner = { type: "TASK" as const, taskId: TASK_A };
      const attachment = Attachment.createLink(
        {
          companyId: COMPANY_A,
          owner,
          title: "  Runbook  ",
          url: "https://example.com/runbook",
          createdBy: USER_A,
          createdAt: CREATED_AT,
        },
        ATTACHMENT_A,
      );

      const created = await attachmentRepository.create(attachment);

      expect(created).toMatchObject({
        kind: "LINK",
        title: "Runbook",
        url: "https://example.com/runbook",
        fileName: null,
        mimeType: null,
        checksum: null,
        sizeBytes: null,
      });
      await expect(attachmentRepository.listByOwner(COMPANY_B, owner)).resolves.toEqual([]);
      await expect(
        attachmentRepository.findById(
          COMPANY_A,
          { type: "REQUISITION", requisitionId: REQUISITION_A },
          ATTACHMENT_A,
        ),
      ).resolves.toBeNull();
    });

    it("rejeita FILE persistido sem fileName", async () => {
      await db.insert(attachments).values({
        id: ATTACHMENT_A,
        companyId: COMPANY_A,
        taskId: TASK_A,
        kind: "FILE",
        mimeType: "application/pdf",
        checksum: "a".repeat(64),
        sizeBytes: 1,
        createdBy: USER_A,
      });

      await expect(
        attachmentRepository.findById(COMPANY_A, { type: "TASK", taskId: TASK_A }, ATTACHMENT_A),
      ).rejects.toThrow("FILE sem fileName");
    });

    it("rejeita LINK persistido com metadado de arquivo", async () => {
      await db.insert(attachments).values({
        id: ATTACHMENT_A,
        companyId: COMPANY_A,
        taskId: TASK_A,
        kind: "LINK",
        title: "Inválido",
        url: "https://example.com",
        fileName: "invalid.pdf",
        createdBy: USER_A,
      });

      await expect(
        attachmentRepository.listByOwner(COMPANY_A, { type: "TASK", taskId: TASK_A }),
      ).rejects.toThrow("LINK com fileName");
    });
  });

  describe("branches adicionais confirmadas", () => {
    it("Membership mapper converte position nula e listas ausentes ficam vazias", async () => {
      await db.insert(memberships).values({
        id: "90000000-0000-4000-8000-000000000001",
        companyId: COMPANY_A,
        userId: USER_A,
        position: null,
        permissions: [],
      });

      const membership = await membershipRepository.findById(
        "90000000-0000-4000-8000-000000000001",
      );

      expect(membership).toMatchObject({ position: "", permissions: [] });
      await expect(membershipRepository.listByCompany(COMPANY_B)).resolves.toEqual([]);
      await expect(membershipRepository.listByUser(USER_B)).resolves.toEqual([]);
      await expect(
        membershipRepository.findById("90000000-0000-4000-8000-000000000099"),
      ).resolves.toBeNull();
    });

    it("Task combina filtros e mantém joins opcionais nulos", async () => {
      await db.insert(memberships).values({
        companyId: COMPANY_A,
        userId: USER_A,
        position: "DESENVOLVEDOR",
      });
      await db.insert(requisitions).values({
        id: REQUISITION_A,
        companyId: COMPANY_A,
        number: 1,
        title: "Req",
        requesterId: USER_A,
      });
      await taskRepository.create(
        buildTask(TASK_A, COMPANY_A, {
          title: "Entrega filtrada",
          status: "IN_PROGRESS",
          priority: "HIGH",
          assigneeId: USER_A,
          requisitionId: REQUISITION_A,
        }),
      );
      await taskRepository.create(
        buildTask(TASK_B, COMPANY_A, { createdAt: new Date("2026-08-14T11:00:00Z") }),
      );

      const filtered = await taskRepository.listByCompany(COMPANY_A, {
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: USER_A,
        requisitionId: REQUISITION_A,
        search: "ENTREGA",
      });

      expect(filtered).toMatchObject([
        {
          task: { id: TASK_A },
          assignee: { id: USER_A, name: "User A" },
          requisition: { id: REQUISITION_A, number: 1, title: "Req" },
        },
      ]);
      expect(await taskRepository.listByCompany(COMPANY_A, { search: "" })).toMatchObject([
        { task: { id: TASK_A }, assignee: { id: USER_A }, requisition: { id: REQUISITION_A } },
        { task: { id: TASK_B }, assignee: null, requisition: null },
      ]);
      await expect(taskRepository.listByCompany(COMPANY_B)).resolves.toEqual([]);
    });

    it("Task status history preserva metadata e retorna vazio para task/tenant ausente", async () => {
      await taskRepository.create(buildTask(TASK_A, COMPANY_A));
      await historyRepository.create(
        TaskStatusHistory.createInitial({
          taskId: TASK_A,
          changedBy: USER_A,
          changedAt: CREATED_AT,
          metadata: { source: "phase-5" },
        }),
      );

      expect(await historyRepository.listByTask(COMPANY_A, TASK_A)).toMatchObject([
        { fromStatus: null, toStatus: "TODO", metadata: { source: "phase-5" } },
      ]);
      await expect(historyRepository.listByTask(COMPANY_B, TASK_A)).resolves.toEqual([]);
      await expect(
        historyRepository.listByTask(COMPANY_A, "70000000-0000-4000-8000-000000000099"),
      ).resolves.toEqual([]);
    });

    it("Task status history rejeita changedBy nulo e estado inicial inválido", async () => {
      await db.insert(tasks).values({ id: TASK_A, companyId: COMPANY_A, title: "Task" });
      await db.insert(taskStatusHistory).values({
        id: "91000000-0000-4000-8000-000000000001",
        taskId: TASK_A,
        fromStatus: "TODO",
        toStatus: "IN_PROGRESS",
        changedBy: null,
      });
      await expect(historyRepository.listByTask(COMPANY_A, TASK_A)).rejects.toThrow(
        "Histórico de status sem changedBy",
      );

      await db.delete(taskStatusHistory);
      await db.insert(taskStatusHistory).values({
        id: "91000000-0000-4000-8000-000000000002",
        taskId: TASK_A,
        fromStatus: null,
        toStatus: "DONE",
        changedBy: USER_A,
      });
      await expect(historyRepository.listByTask(COMPANY_A, TASK_A)).rejects.toThrow(
        "Histórico inicial de status inválido",
      );
    });

    it("TimeEntry retorna vazio/zero e não cruza tenant", async () => {
      await db.insert(tasks).values({ id: TASK_A, companyId: COMPANY_A, title: "Task" });

      await expect(timeEntryRepository.listByTask(COMPANY_A, TASK_A, 10)).resolves.toEqual([]);
      await expect(timeEntryRepository.sumDurationByTask(COMPANY_A, TASK_A)).resolves.toBe(0);

      await timeEntryRepository.create(
        TimeEntry.create({
          companyId: COMPANY_A,
          taskId: TASK_A,
          userId: USER_A,
          durationMinutes: 30,
          description: "  ",
          createdAt: CREATED_AT,
        }),
      );

      await expect(timeEntryRepository.listByTask(COMPANY_B, TASK_A, 10)).resolves.toEqual([]);
      await expect(timeEntryRepository.sumDurationByTask(COMPANY_B, TASK_A)).resolves.toBe(0);
      await expect(timeEntryRepository.listByTask(COMPANY_A, TASK_A, 10)).resolves.toMatchObject([
        { durationMinutes: 30, description: null, startedAt: null, endedAt: null },
      ]);
    });

    it("Requisition ignora busca em branco e retorna vazio para outro tenant", async () => {
      await db.insert(requisitions).values({
        id: REQUISITION_A,
        companyId: COMPANY_A,
        number: 1,
        title: "Requisição",
        requesterId: USER_A,
      });

      await expect(
        requisitionRepository.listByCompany(COMPANY_A, { search: "   " }),
      ).resolves.toHaveLength(1);
      await expect(
        requisitionRepository.listByCompany(COMPANY_B, { search: "   " }),
      ).resolves.toEqual([]);
    });

    it("RequisitionAssignee mantém delete tenant-aware e listas vazias", async () => {
      await db.insert(requisitions).values({
        id: REQUISITION_A,
        companyId: COMPANY_A,
        number: 1,
        title: "Requisição",
        requesterId: USER_A,
      });
      await assigneeRepository.create(COMPANY_A, REQUISITION_A, USER_A);

      await assigneeRepository.delete(COMPANY_B, REQUISITION_A, USER_A);

      await expect(
        assigneeRepository.findByRequisitionAndUser(COMPANY_A, REQUISITION_A, USER_A),
      ).resolves.not.toBeNull();
      await expect(assigneeRepository.listByRequisition(COMPANY_B, REQUISITION_A)).resolves.toEqual(
        [],
      );
      await expect(
        assigneeRepository.listByRequisition(COMPANY_A, "60000000-0000-4000-8000-000000000099"),
      ).resolves.toEqual([]);
    });
  });
});
