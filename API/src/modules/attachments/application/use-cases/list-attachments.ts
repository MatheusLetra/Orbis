import {
  type AttachmentOutput,
  type ListAttachmentsInput,
  listAttachmentsSchema,
  toAttachmentOutput,
} from "@/modules/attachments/application/dto/attachment-dtos";
import type { AttachmentOwner } from "@/modules/attachments/domain/entities/attachment";
import type { AttachmentRepository } from "@/modules/attachments/domain/repositories/attachment-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface ListAttachmentsCommand {
  actor: AuthenticatedUser;
  data: ListAttachmentsInput;
}

export class ListAttachments implements UseCase<ListAttachmentsCommand, AttachmentOutput[]> {
  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    private readonly requisitionRepository: RequisitionRepository,
    private readonly taskRepository: TaskRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListAttachmentsCommand): Promise<AttachmentOutput[]> {
    const parsed = listAttachmentsSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de listagem de anexos inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(
      input.actor,
      parsed.data.owner.type === "REQUISITION" ? "requisitions.read" : "tasks.read",
    );
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);
    await this.assertParent(parsed.data.owner, input.actor.companyId);

    const attachments = await this.attachmentRepository.listByOwner(
      input.actor.companyId,
      parsed.data.owner,
    );
    return attachments.map(toAttachmentOutput);
  }

  private async assertParent(owner: AttachmentOwner, companyId: string): Promise<void> {
    if (owner.type === "REQUISITION") {
      const requisition = await this.requisitionRepository.findById(owner.requisitionId);
      if (!requisition || requisition.companyId !== companyId) {
        throw new NotFoundError("Requisição não encontrada");
      }
      return;
    }

    if (!(await this.taskRepository.findById(companyId, owner.taskId))) {
      throw new NotFoundError("Tarefa não encontrada");
    }
  }
}
