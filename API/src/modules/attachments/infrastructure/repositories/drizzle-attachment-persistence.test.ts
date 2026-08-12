import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import {
  attachments,
  companies,
  requisitions,
  tasks,
  users,
} from "@/infrastructure/database/schema";
import { Attachment, type AttachmentOwner } from "@/modules/attachments/domain/entities/attachment";
import { DrizzleAttachmentBlobRepository } from "@/modules/attachments/infrastructure/repositories/drizzle-attachment-blob-repository";
import { DrizzleAttachmentRepository } from "@/modules/attachments/infrastructure/repositories/drizzle-attachment-repository";
import { DrizzleAttachmentUnitOfWork } from "@/modules/attachments/infrastructure/unit-of-work/drizzle-attachment-unit-of-work";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "33333333-3333-4333-8333-333333333333";
const USER_B = "44444444-4444-4444-8444-444444444444";
const REQUISITION_A = "55555555-5555-4555-8555-555555555555";
const REQUISITION_B = "66666666-6666-4666-8666-666666666666";
const TASK_A = "77777777-7777-4777-8777-777777777777";
const TASK_B = "88888888-8888-4888-8888-888888888888";

const requisitionOwner: AttachmentOwner = { type: "REQUISITION", requisitionId: REQUISITION_A };
const taskOwner: AttachmentOwner = { type: "TASK", taskId: TASK_A };

function buildFile(
  id: string,
  owner = requisitionOwner,
  companyId = COMPANY_A,
  createdAt = new Date("2026-08-12T10:00:00Z"),
) {
  return Attachment.createFile(
    {
      companyId,
      owner,
      fileName: "manual.pdf",
      mimeType: "application/pdf",
      checksum: "a".repeat(64),
      sizeBytes: 5,
      createdBy: USER_A,
      createdAt,
    },
    id,
  );
}

function buildLink(id: string, owner = taskOwner, companyId = COMPANY_A) {
  return Attachment.createLink(
    {
      companyId,
      owner,
      title: "Documentação",
      url: "https://example.com/docs",
      createdBy: USER_A,
      createdAt: new Date("2026-08-12T11:00:00Z"),
    },
    id,
  );
}

describe.skipIf(!available)("persistência de Attachments", () => {
  let db: Database;
  let repository: DrizzleAttachmentRepository;
  let blobRepository: DrizzleAttachmentBlobRepository;
  let unitOfWork: DrizzleAttachmentUnitOfWork;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new DrizzleAttachmentRepository(db);
    blobRepository = new DrizzleAttachmentBlobRepository(db);
    unitOfWork = new DrizzleAttachmentUnitOfWork(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE attachments, requisitions, tasks, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC" },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC" },
    ]);
    await db.insert(users).values([
      { id: USER_A, email: "user-a@example.com", name: "User A", passwordHash: "hash" },
      { id: USER_B, email: "user-b@example.com", name: "User B", passwordHash: "hash" },
    ]);
    await db.insert(requisitions).values([
      { id: REQUISITION_A, companyId: COMPANY_A, number: 1, title: "Req A", requesterId: USER_A },
      { id: REQUISITION_B, companyId: COMPANY_B, number: 1, title: "Req B", requesterId: USER_B },
    ]);
    await db.insert(tasks).values([
      { id: TASK_A, companyId: COMPANY_A, title: "Task A" },
      { id: TASK_B, companyId: COMPANY_B, title: "Task B" },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("cria e restaura FILE e LINK metadata", async () => {
    const file = await repository.create(buildFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    const link = await repository.create(buildLink("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));

    expect(file.kind).toBe("FILE");
    expect(file.owner).toEqual(requisitionOwner);
    expect(link.kind).toBe("LINK");
    expect(link.owner).toEqual(taskOwner);
  });

  it("isola find e list por tenant e owner", async () => {
    const file = await repository.create(buildFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    await repository.create(
      buildFile(
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        { type: "REQUISITION", requisitionId: REQUISITION_B },
        COMPANY_B,
      ),
    );

    await expect(repository.findById(COMPANY_B, requisitionOwner, file.id)).resolves.toBeNull();
    await expect(repository.findById(COMPANY_A, taskOwner, file.id)).resolves.toBeNull();
    await expect(
      repository.listByOwner(COMPANY_B, { type: "REQUISITION", requisitionId: REQUISITION_B }),
    ).resolves.toHaveLength(1);
    await expect(repository.listByOwner(COMPANY_A, requisitionOwner)).resolves.toHaveLength(1);
  });

  it("ordena por createdAt e id e nunca retorna blob", async () => {
    await repository.create(
      buildFile(
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        requisitionOwner,
        COMPANY_A,
        new Date("2026-08-12T10:00:00Z"),
      ),
    );
    await repository.create(
      buildFile(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requisitionOwner,
        COMPANY_A,
        new Date("2026-08-12T10:00:00Z"),
      ),
    );

    const result = await repository.listByOwner(COMPANY_A, requisitionOwner);
    expect(result.map(({ id }) => id)).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ]);
    expect(result.every((item) => !("data" in item))).toBe(true);
  });

  it("persiste e lê bytes íntegros", async () => {
    const attachment = await repository.create(buildFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    const data = Buffer.from([0, 1, 2, 255]);
    await blobRepository.create(attachment.id, data);

    expect(await blobRepository.findByAttachmentId(attachment.id)).toEqual(data);
    await expect(
      blobRepository.findByAttachmentId("99999999-9999-4999-8999-999999999999"),
    ).resolves.toBeNull();
  });

  it("permite metadata sem blob e retorna blob nulo", async () => {
    const attachment = await repository.create(buildFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    expect(await repository.findById(COMPANY_A, requisitionOwner, attachment.id)).not.toBeNull();
    await expect(blobRepository.findByAttachmentId(attachment.id)).resolves.toBeNull();
  });

  it("deleta metadata com tenant e owner e o cascade remove blob", async () => {
    const attachment = await repository.create(buildFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    await blobRepository.create(attachment.id, Buffer.from("data"));

    await repository.delete(COMPANY_B, requisitionOwner, attachment.id);
    expect(await blobRepository.findByAttachmentId(attachment.id)).not.toBeNull();
    await repository.delete(COMPANY_A, requisitionOwner, attachment.id);
    expect(await blobRepository.findByAttachmentId(attachment.id)).toBeNull();
  });

  it("confirma FILE + blob na mesma transação", async () => {
    const attachment = buildFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await unitOfWork.execute(async ({ attachments, blobs }) => {
      const saved = await attachments.create(attachment);
      await blobs.create(saved.id, Buffer.from("atomic"));
    });

    expect(await blobRepository.findByAttachmentId(attachment.id)).toEqual(Buffer.from("atomic"));
  });

  it("faz rollback quando callback falha depois dos inserts", async () => {
    const attachment = buildFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await expect(
      unitOfWork.execute(async ({ attachments, blobs }) => {
        await attachments.create(attachment);
        await blobs.create(attachment.id, Buffer.from("atomic"));
        throw new Error("falha transacional");
      }),
    ).rejects.toThrow("falha transacional");

    expect(await repository.findById(COMPANY_A, requisitionOwner, attachment.id)).toBeNull();
    expect(await blobRepository.findByAttachmentId(attachment.id)).toBeNull();
  });

  it("rollback quando create do blob falha por duplicate key", async () => {
    const attachment = buildFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await unitOfWork.execute(async ({ attachments, blobs }) => {
      await attachments.create(attachment);
      await blobs.create(attachment.id, Buffer.from("first"));
    });

    const second = buildFile("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    await expect(
      unitOfWork.execute(async ({ attachments, blobs }) => {
        await attachments.create(second);
        await blobs.create(attachment.id, Buffer.from("duplicate"));
      }),
    ).rejects.toThrow();

    expect(await repository.findById(COMPANY_A, requisitionOwner, second.id)).toBeNull();
  });

  it.each([
    ["requisition", sql`DELETE FROM requisitions WHERE id = ${REQUISITION_A}`],
    ["task", sql`DELETE FROM tasks WHERE id = ${TASK_A}`],
    ["company", sql`DELETE FROM companies WHERE id = ${COMPANY_A}`],
  ] as const)("cascade remove attachment/blob ao excluir %s", async (_, deletion) => {
    const owner = _ === "requisition" ? requisitionOwner : taskOwner;
    const attachment = await repository.create(
      buildFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", owner),
    );
    await blobRepository.create(attachment.id, Buffer.from("cascade"));
    await db.execute(deletion);
    expect(await blobRepository.findByAttachmentId(attachment.id)).toBeNull();
  });

  it("impede dois owners e nenhum owner", async () => {
    await expect(
      db.insert(attachments).values({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        companyId: COMPANY_A,
        requisitionId: REQUISITION_A,
        taskId: TASK_A,
        kind: "LINK",
        title: "invalid",
        url: "https://example.com",
        createdBy: USER_A,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(attachments).values({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        companyId: COMPANY_A,
        kind: "LINK",
        title: "invalid",
        url: "https://example.com",
        createdBy: USER_A,
      }),
    ).rejects.toThrow();
  });
});
