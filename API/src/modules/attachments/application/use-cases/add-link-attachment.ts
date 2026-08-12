import {
  type AddLinkAttachmentInput,
  type AttachmentOutput,
  addLinkAttachmentSchema,
  toAttachmentOutput,
} from "@/modules/attachments/application/dto/attachment-dtos";
import { Attachment } from "@/modules/attachments/domain/entities/attachment";
import type { AttachmentRepository } from "@/modules/attachments/domain/repositories/attachment-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface AddLinkAttachmentCommand {
  actor: AuthenticatedUser;
  data: AddLinkAttachmentInput;
}

export class AddLinkAttachment implements UseCase<AddLinkAttachmentCommand, AttachmentOutput> {
  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    private readonly requisitionRepository: RequisitionRepository,
    private readonly taskRepository: TaskRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: AddLinkAttachmentCommand): Promise<AttachmentOutput> {
    const parsed = addLinkAttachmentSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de anexo de link inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    const permission =
      parsed.data.owner.type === "REQUISITION" ? "requisitions.update" : "tasks.update";
    this.authorization.assertPermission(input.actor, permission);
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);
    await this.assertParent(parsed.data.owner, input.actor.companyId);

    const attachment = Attachment.createLink({
      companyId: input.actor.companyId,
      owner: parsed.data.owner,
      title: parsed.data.title,
      url: parsed.data.url,
      createdBy: input.actor.userId,
    });
    const saved = await this.attachmentRepository.create(attachment);

    return toAttachmentOutput(saved);
  }

  private async assertParent(
    owner: AddLinkAttachmentInput["owner"],
    companyId: string,
  ): Promise<void> {
    if (owner.type === "REQUISITION") {
      const requisition = await this.requisitionRepository.findById(owner.requisitionId);
      if (!requisition || requisition.companyId !== companyId) {
        throw new NotFoundError("Requisição não encontrada");
      }
      return;
    }

    const task = await this.taskRepository.findById(companyId, owner.taskId);
    if (!task) throw new NotFoundError("Tarefa não encontrada");
  }
}
