import { describe, expect, it } from "vitest";

import type { AttachmentUnitOfWork } from "@/modules/attachments/application/ports/attachment-unit-of-work";
import { AddFileAttachment } from "@/modules/attachments/application/use-cases/add-file-attachment";
import type { Attachment, AttachmentOwner } from "@/modules/attachments/domain/entities/attachment";
import type { AttachmentBlobRepository } from "@/modules/attachments/domain/repositories/attachment-blob-repository";
import type { AttachmentRepository } from "@/modules/attachments/domain/repositories/attachment-repository";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { Task } from "@/modules/tasks/domain/entities/task";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/shared/errors/typed-errors";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const REQUISITION = "44444444-4444-4444-8444-444444444444";
const TASK = "55555555-5555-4555-8555-555555555555";
const ownerRequisition: AttachmentOwner = { type: "REQUISITION", requisitionId: REQUISITION };
const ownerTask: AttachmentOwner = { type: "TASK", taskId: TASK };

const actor: AuthenticatedUser = {
  userId: USER,
  companyId: COMPANY,
  permissions: ["requisitions.update", "tasks.update"],
};

function requisition(companyId = COMPANY): Requisition {
  return {
    companyId,
  } as Requisition;
}

function task(companyId = COMPANY, status: "TODO" | "DONE" = "TODO"): Task {
  return { companyId, status } as Task;
}

class FakeRequisitionRepository implements RequisitionRepository {
  item: Requisition | null = requisition();
  async create(value: Requisition) {
    return value;
  }
  async findById() {
    return this.item;
  }
  async update(value: Requisition) {
    return value;
  }
  async delete() {}
  async listByCompany() {
    return [];
  }
}

class FakeTaskRepository implements TaskRepository {
  item: Task | null = task();
  async create(value: Task) {
    return value;
  }
  async findById() {
    return this.item;
  }
  async findByIdForUpdate() {
    return this.item;
  }
  async update(value: Task) {
    return value;
  }
  async listByCompany() {
    return [];
  }
}

class FakeMembershipRepository implements MembershipRepository {
  active = true;
  async findByUserAndCompany() {
    return this.active ? ({ isActive: true } as never) : null;
  }
  async create(value: never) {
    return value;
  }
  async listByCompany() {
    return [];
  }
}

class FakeAttachmentRepository implements AttachmentRepository {
  items: Attachment[] = [];
  async create(value: Attachment) {
    this.items.push(value);
    return value;
  }
  async findById() {
    return null;
  }
  async listByOwner() {
    return this.items;
  }
  async delete() {}
}

class FakeBlobRepository implements AttachmentBlobRepository {
  data: Buffer | null = null;
  async create(_id: string, data: Buffer) {
    this.data = data;
  }
  async findByAttachmentId() {
    return this.data;
  }
}

class FakeUnitOfWork implements AttachmentUnitOfWork {
  attachments = new FakeAttachmentRepository();
  blobs = new FakeBlobRepository();
  failBlob = false;
  calls = 0;
  async execute<T>(
    callback: (context: {
      attachments: AttachmentRepository;
      blobs: AttachmentBlobRepository;
    }) => Promise<T>,
  ) {
    this.calls += 1;
    const attachmentSnapshot = [...this.attachments.items];
    const blobSnapshot = this.blobs.data;
    const blobs: AttachmentBlobRepository = {
      create: async (id, data) => {
        if (this.failBlob) throw new Error("blob failure");
        await this.blobs.create(id, data);
      },
      findByAttachmentId: (id) => this.blobs.findByAttachmentId(id),
    };
    try {
      return await callback({ attachments: this.attachments, blobs });
    } catch (error) {
      this.attachments.items = attachmentSnapshot;
      this.blobs.data = blobSnapshot;
      throw error;
    }
  }
}

function setup() {
  const requisitions = new FakeRequisitionRepository();
  const tasks = new FakeTaskRepository();
  const memberships = new FakeMembershipRepository();
  const unitOfWork = new FakeUnitOfWork();
  const useCase = new AddFileAttachment(
    unitOfWork,
    requisitions,
    tasks,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );
  return { useCase, requisitions, tasks, memberships, unitOfWork };
}

function input(owner: AttachmentOwner = ownerRequisition, data = Buffer.from("%PDF-")) {
  return { owner, data, fileName: "  manual.PDF  ", title: "  Guia  " };
}

describe("AddFileAttachment", () => {
  it("cria FILE com metadata derivada, actor e blob real", async () => {
    const { useCase, unitOfWork } = setup();
    const data = Buffer.from("%PDF-real");
    const output = await useCase.execute({ actor, data: input(ownerRequisition, data) });

    expect(output).toMatchObject({
      companyId: COMPANY,
      createdBy: USER,
      kind: "FILE",
      fileName: "manual.PDF",
      mimeType: "application/pdf",
      sizeBytes: data.length,
      title: "Guia",
    });
    expect(output.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(unitOfWork.calls).toBe(1);
    expect(unitOfWork.blobs.data).toBe(data);
    expect("data" in output).toBe(false);
  });

  it("usa permissão e parent de Task, inclusive DONE", async () => {
    const { useCase, tasks } = setup();
    tasks.item = task(COMPANY, "DONE");
    const output = await useCase.execute({ actor, data: input(ownerTask) });
    expect(output.owner).toEqual(ownerTask);
  });

  it("rejeita parent ausente, outro tenant e membership inativa", async () => {
    const first = setup();
    first.requisitions.item = null;
    await expect(first.useCase.execute({ actor, data: input() })).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const second = setup();
    second.requisitions.item = requisition(OTHER_COMPANY);
    await expect(second.useCase.execute({ actor, data: input() })).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const third = setup();
    third.memberships.active = false;
    await expect(third.useCase.execute({ actor, data: input() })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(third.unitOfWork.calls).toBe(0);
  });

  it("rejeita owner inválido antes da autorização e parent", async () => {
    const { useCase, unitOfWork } = setup();
    await expect(
      useCase.execute({ actor, data: input({ type: "OTHER" } as never) }),
    ).rejects.toThrow();
    expect(unitOfWork.calls).toBe(0);
  });

  it("não processa arquivo quando permissão falta", async () => {
    const { useCase, unitOfWork } = setup();
    const unauthorized = { ...actor, permissions: [] } as AuthenticatedUser;
    await expect(useCase.execute({ actor: unauthorized, data: input() })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(unitOfWork.calls).toBe(0);
  });

  it.each([Buffer.alloc(0), Buffer.from("unknown")])("rejeita conteúdo inválido", async (data) => {
    const { useCase, unitOfWork } = setup();
    await expect(
      useCase.execute({ actor, data: input(ownerRequisition, data) }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(unitOfWork.calls).toBe(0);
  });

  it("rejeita extensão incompatível e tamanho acima do limite", async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ actor, data: { ...input(), fileName: "manual.png" } }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    const data = Buffer.alloc(10 * 1024 * 1024 + 1);
    data.write("%PDF-");
    await expect(
      useCase.execute({ actor, data: input(ownerRequisition, data) }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("propaga falha do blob e executa rollback do fake", async () => {
    const { useCase, unitOfWork } = setup();
    unitOfWork.failBlob = true;
    await expect(useCase.execute({ actor, data: input() })).rejects.toThrow("blob failure");
    expect(unitOfWork.attachments.items).toHaveLength(0);
    expect(unitOfWork.blobs.data).toBeNull();
  });
});
