import {
  type AuditRecorder,
  NOOP_AUDIT_RECORDER,
} from "@/modules/audit/application/ports/audit-recorder";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import {
  NOOP_NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from "@/modules/notifications/application/ports/notification-dispatcher";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type RequisitionOutput,
  toRequisitionOutput,
  type UpdateRequisitionInput,
  updateRequisitionSchema,
} from "@/modules/requisitions/application/dto/requisition-dtos";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface UpdateRequisitionCommand {
  actor: AuthenticatedUser;
  requisitionId: string;
  changes: UpdateRequisitionInput;
}

export class UpdateRequisition implements UseCase<UpdateRequisitionCommand, RequisitionOutput> {
  constructor(
    private readonly requisitionRepository: RequisitionRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly systemRepository: SystemRepository,
    private readonly systemVersionRepository: SystemVersionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly notifications: NotificationDispatcher = NOOP_NOTIFICATION_DISPATCHER,
    private readonly audit: AuditRecorder = NOOP_AUDIT_RECORDER,
  ) {}

  async execute(input: UpdateRequisitionCommand): Promise<RequisitionOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "requisitions.update");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = updateRequisitionSchema.safeParse(input.changes);
    if (!parsed.success) {
      throw new ValidationError("Dados de requisição inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const requisition = await this.requisitionRepository.findById(input.requisitionId);
    if (!requisition || requisition.companyId !== input.actor.companyId) {
      throw new NotFoundError("Requisição não encontrada");
    }
    const previousResponsibleId = requisition.responsibleId;
    const previousDeliveredAt = requisition.deliveredAt;

    const responsibleId =
      parsed.data.responsibleId !== undefined
        ? parsed.data.responsibleId
        : requisition.responsibleId;
    const systemId =
      parsed.data.systemId !== undefined ? parsed.data.systemId : requisition.systemId;
    const systemVersionId =
      parsed.data.systemVersionId !== undefined
        ? parsed.data.systemVersionId
        : requisition.systemVersionId;

    if (responsibleId !== null) {
      const membership = await this.membershipRepository.findByUserAndCompany(
        responsibleId,
        input.actor.companyId,
      );
      if (!membership?.isActive) {
        throw new NotFoundError("Responsável não encontrado");
      }
    }

    if (systemId !== null) {
      const system = await this.systemRepository.findById(systemId);
      if (!system || system.companyId !== input.actor.companyId) {
        throw new NotFoundError("Sistema não encontrado");
      }
    }

    let versionSystemId: string | null = null;
    if (systemVersionId !== null) {
      const version = await this.systemVersionRepository.findById(systemVersionId);
      if (!version || version.companyId !== input.actor.companyId) {
        throw new NotFoundError("Versão não encontrada");
      }
      versionSystemId = version.systemId;
    }

    if (systemId !== null && systemVersionId !== null) {
      if (versionSystemId !== systemId) {
        throw new NotFoundError("Versão não encontrada");
      }
    }

    if (parsed.data.title !== undefined) {
      requisition.rename(parsed.data.title);
    }
    if (parsed.data.description !== undefined) {
      requisition.changeDescription(parsed.data.description);
    }
    if (parsed.data.priority !== undefined) {
      requisition.changePriority(parsed.data.priority);
    }
    if (parsed.data.responsibleId !== undefined) {
      requisition.changeResponsible(parsed.data.responsibleId);
    }
    if (parsed.data.systemId !== undefined) {
      requisition.changeSystem(parsed.data.systemId);
    }
    if (parsed.data.systemVersionId !== undefined) {
      requisition.changeSystemVersion(parsed.data.systemVersionId);
    }
    if (parsed.data.estimatedHours !== undefined) {
      requisition.changeEstimatedHours(parsed.data.estimatedHours);
    }
    if (parsed.data.startDate !== undefined) {
      requisition.changeStartDate(parsed.data.startDate);
    }
    if (parsed.data.plannedDeliveryDate !== undefined) {
      requisition.changePlannedDeliveryDate(parsed.data.plannedDeliveryDate);
    }
    if (parsed.data.deliveredAt !== undefined) {
      requisition.changeDeliveredAt(parsed.data.deliveredAt);
    }

    const updated = await this.requisitionRepository.update(requisition);

    await this.audit.record({
      companyId: updated.companyId,
      actorUserId: input.actor.userId,
      action: "REQUISITION_UPDATED",
      entityType: "REQUISITION",
      entityId: updated.id,
      metadata: { changedFields: Object.keys(parsed.data) },
    });

    if (updated.responsibleId && updated.responsibleId !== previousResponsibleId) {
      await this.notifications
        .handle({
          eventType: "REQUISITION_ASSIGNED",
          companyId: updated.companyId,
          actorId: input.actor.userId,
          recipientIds: [updated.responsibleId],
          title: "Requisição atribuída",
          body: updated.title,
          data: { requisitionId: updated.id },
        })
        .catch(() => undefined);
    }
    if (previousDeliveredAt === null && updated.deliveredAt !== null && updated.responsibleId) {
      await this.notifications
        .handle({
          eventType: "REQUISITION_COMPLETED",
          companyId: updated.companyId,
          actorId: input.actor.userId,
          recipientIds: [updated.responsibleId],
          title: "Requisição concluída",
          body: updated.title,
          data: { requisitionId: updated.id },
        })
        .catch(() => undefined);
    }

    return toRequisitionOutput(updated);
  }
}
