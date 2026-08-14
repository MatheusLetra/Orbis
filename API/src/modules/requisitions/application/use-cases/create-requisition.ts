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
  type CreateRequisitionInput,
  createRequisitionSchema,
  type RequisitionOutput,
  toRequisitionOutput,
} from "@/modules/requisitions/application/dto/requisition-dtos";
import type { RequisitionNumberGenerator } from "@/modules/requisitions/application/ports/requisition-number-generator";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { SystemRepository } from "@/modules/systems/domain/repositories/system-repository";
import type { SystemVersionRepository } from "@/modules/versions/domain/repositories/system-version-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface CreateRequisitionCommand {
  actor: AuthenticatedUser;
  data: CreateRequisitionInput;
}

export class CreateRequisition implements UseCase<CreateRequisitionCommand, RequisitionOutput> {
  constructor(
    private readonly requisitionRepository: RequisitionRepository,
    private readonly numberGenerator: RequisitionNumberGenerator,
    private readonly membershipRepository: MembershipRepository,
    private readonly systemRepository: SystemRepository,
    private readonly systemVersionRepository: SystemVersionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly notifications: NotificationDispatcher = NOOP_NOTIFICATION_DISPATCHER,
    private readonly audit: AuditRecorder = NOOP_AUDIT_RECORDER,
  ) {}

  async execute(input: CreateRequisitionCommand): Promise<RequisitionOutput> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "requisitions.create");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = createRequisitionSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Dados de requisição inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    if (parsed.data.responsibleId) {
      const membership = await this.membershipRepository.findByUserAndCompany(
        parsed.data.responsibleId,
        input.actor.companyId,
      );
      if (!membership?.isActive) {
        throw new NotFoundError("Responsável não encontrado");
      }
    }

    if (parsed.data.systemId) {
      const system = await this.systemRepository.findById(parsed.data.systemId);
      if (!system || system.companyId !== input.actor.companyId) {
        throw new NotFoundError("Sistema não encontrado");
      }
    }

    if (parsed.data.systemVersionId) {
      const version = await this.systemVersionRepository.findById(parsed.data.systemVersionId);
      if (!version || version.companyId !== input.actor.companyId) {
        throw new NotFoundError("Versão não encontrada");
      }

      if (parsed.data.systemId && version.systemId !== parsed.data.systemId) {
        throw new NotFoundError("Versão não encontrada");
      }
    }

    const number = await this.numberGenerator.next(input.actor.companyId);
    const requisition = Requisition.create({
      ...parsed.data,
      companyId: input.actor.companyId,
      requesterId: input.actor.userId,
      number,
    });
    const created = await this.requisitionRepository.create(requisition);

    await this.audit.record({
      companyId: created.companyId,
      actorUserId: input.actor.userId,
      action: "REQUISITION_CREATED",
      entityType: "REQUISITION",
      entityId: created.id,
      metadata: { number: created.number },
    });

    if (created.responsibleId) {
      await this.notifications
        .handle({
          eventType: "REQUISITION_ASSIGNED",
          companyId: created.companyId,
          actorId: input.actor.userId,
          recipientIds: [created.responsibleId],
          title: "Requisição atribuída",
          body: created.title,
          data: { requisitionId: created.id },
        })
        .catch(() => undefined);
    }

    return toRequisitionOutput(created);
  }
}
