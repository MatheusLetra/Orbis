import { describe, expect, it } from "vitest";
import { AddLinkAttachment } from "@/modules/attachments/application/use-cases/add-link-attachment";
import type { Attachment, AttachmentOwner } from "@/modules/attachments/domain/entities/attachment";
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
const requisitionOwner: AttachmentOwner = { type: "REQUISITION", requisitionId: REQUISITION };
const taskOwner: AttachmentOwner = { type: "TASK", taskId: TASK };
const actor: AuthenticatedUser = {
  userId: USER,
  companyId: COMPANY,
  permissions: ["requisitions.update", "tasks.update"],
};

class FakeRequisitions implements RequisitionRepository {
  item: Requisition | null = { companyId: COMPANY } as Requisition;
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
class FakeTasks implements TaskRepository {
  item: Task | null = { companyId: COMPANY, status: "DONE" } as Task;
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
class FakeMemberships implements MembershipRepository {
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
class FakeAttachments implements AttachmentRepository {
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

function setup() {
  const attachments = new FakeAttachments();
  const requisitions = new FakeRequisitions();
  const tasks = new FakeTasks();
  const memberships = new FakeMemberships();
  const useCase = new AddLinkAttachment(
    attachments,
    requisitions,
    tasks,
    new MembershipAccessService(memberships),
    new AuthorizationService(),
  );
  return { useCase, attachments, requisitions, tasks, memberships };
}

function input(owner: AttachmentOwner = requisitionOwner) {
  return { owner, title: "  Documentação  ", url: "  HTTPS://Example.COM/docs  " };
}

describe("AddLinkAttachment", () => {
  it("cria LINK diretamente no repository e normaliza metadata", async () => {
    const { useCase, attachments } = setup();
    const output = await useCase.execute({ actor, data: input() });
    expect(output).toMatchObject({
      companyId: COMPANY,
      createdBy: USER,
      kind: "LINK",
      title: "Documentação",
      url: "https://example.com/docs",
    });
    expect(attachments.items).toHaveLength(1);
    expect(output).not.toHaveProperty("data");
  });

  it("usa permissão de Task e aceita Task DONE", async () => {
    const { useCase } = setup();
    const output = await useCase.execute({ actor, data: input(taskOwner) });
    expect(output.owner).toEqual(taskOwner);
  });

  it("rejeita owner inválido antes da persistência", async () => {
    const { useCase, attachments } = setup();
    await expect(
      useCase.execute({ actor, data: input({ type: "OTHER" } as never) }),
    ).rejects.toThrow();
    expect(attachments.items).toHaveLength(0);
  });

  it("rejeita parent, tenant ou membership inválidos", async () => {
    const first = setup();
    first.requisitions.item = null;
    await expect(first.useCase.execute({ actor, data: input() })).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const second = setup();
    second.requisitions.item = { companyId: OTHER_COMPANY } as Requisition;
    await expect(second.useCase.execute({ actor, data: input() })).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const third = setup();
    third.memberships.active = false;
    await expect(third.useCase.execute({ actor, data: input() })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it.each([
    { title: "", url: "https://example.com" },
    { title: "Title", url: "ftp://example.com" },
    { title: "Title", url: "https://user:pass@example.com" },
    { title: "Title", url: "invalid" },
  ])("rejeita link inválido: %j", async (data) => {
    const { useCase, attachments } = setup();
    await expect(useCase.execute({ actor, data: { ...input(), ...data } })).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
    expect(attachments.items).toHaveLength(0);
  });

  it("não usa Unit of Work nem cria blob", async () => {
    const { useCase } = setup();
    const output = await useCase.execute({ actor, data: input() });
    expect(output.kind).toBe("LINK");
    expect(output).not.toHaveProperty("checksum", expect.anything());
    expect(output).not.toHaveProperty("sizeBytes", expect.anything());
  });
});
