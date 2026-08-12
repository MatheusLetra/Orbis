import {
  type AddFileAttachmentInput,
  type AttachmentOutput,
  addFileAttachmentSchema,
  toAttachmentOutput,
} from "@/modules/attachments/application/dto/attachment-dtos";
import type { AttachmentUnitOfWork } from "@/modules/attachments/application/ports/attachment-unit-of-work";
import { prepareFileAttachmentMetadata } from "@/modules/attachments/domain/attachment-file-validation";
import { Attachment } from "@/modules/attachments/domain/entities/attachment";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface AddFileAttachmentCommand {
  actor: AuthenticatedUser;
  data: AddFileAttachmentInput;
}

export class AddFileAttachment implements UseCase<AddFileAttachmentCommand, AttachmentOutput> {
  constructor(
    private readonly unitOfWork: AttachmentUnitOfWork,
    private readonly requisitionRepository: RequisitionRepository,
    private readonly taskRepository: TaskRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: AddFileAttachmentCommand): Promise<AttachmentOutput> {
    const parsed = addFileAttachmentSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de anexo de arquivo inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    const permission =
      parsed.data.owner.type === "REQUISITION" ? "requisitions.update" : "tasks.update";
    this.authorization.assertPermission(input.actor, permission);
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);
    await this.assertParent(parsed.data.owner, input.actor.companyId);

    const metadata = prepareFileAttachmentMetadata(
      parsed.data.data,
      parsed.data.fileName,
      parsed.data.title,
    );
    const attachment = Attachment.createFile({
      companyId: input.actor.companyId,
      owner: parsed.data.owner,
      title: metadata.title ?? undefined,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      checksum: metadata.checksum,
      sizeBytes: metadata.sizeBytes,
      createdBy: input.actor.userId,
    });

    const saved = await this.unitOfWork.execute(async ({ attachments, blobs }) => {
      const created = await attachments.create(attachment);
      await blobs.create(created.id, parsed.data.data);
      return created;
    });

    return toAttachmentOutput(saved);
  }

  private async assertParent(
    owner: AddFileAttachmentInput["owner"],
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
