import { createHash } from "node:crypto";
import {
  type AttachmentOutput,
  type GetFileAttachmentInput,
  getFileAttachmentSchema,
  toAttachmentOutput,
} from "@/modules/attachments/application/dto/attachment-dtos";
import type { AttachmentOwner } from "@/modules/attachments/domain/entities/attachment";
import type { AttachmentBlobRepository } from "@/modules/attachments/domain/repositories/attachment-blob-repository";
import type { AttachmentRepository } from "@/modules/attachments/domain/repositories/attachment-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { TaskRepository } from "@/modules/tasks/domain/repositories/task-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface GetFileAttachmentCommand {
  actor: AuthenticatedUser;
  data: GetFileAttachmentInput;
}

export interface GetFileAttachmentOutput {
  attachment: AttachmentOutput;
  data: Buffer;
}

export class GetFileAttachment
  implements UseCase<GetFileAttachmentCommand, GetFileAttachmentOutput>
{
  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    private readonly blobRepository: AttachmentBlobRepository,
    private readonly requisitionRepository: RequisitionRepository,
    private readonly taskRepository: TaskRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetFileAttachmentCommand): Promise<GetFileAttachmentOutput> {
    const parsed = getFileAttachmentSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de download de anexo inválidos", {
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

    const attachment = await this.attachmentRepository.findById(
      input.actor.companyId,
      parsed.data.owner,
      parsed.data.attachmentId,
    );
    if (!attachment) throw new NotFoundError("Anexo não encontrado");
    if (attachment.kind !== "FILE") {
      throw new BusinessRuleError("Anexo não é um arquivo");
    }

    const data = await this.blobRepository.findByAttachmentId(attachment.id);
    if (!data) throw new BusinessRuleError("Blob do anexo não encontrado");

    const checksum = createHash("sha256").update(data).digest("hex");
    if (checksum !== attachment.checksum) {
      throw new BusinessRuleError("Integridade do anexo inválida");
    }

    return { attachment: toAttachmentOutput(attachment), data };
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
