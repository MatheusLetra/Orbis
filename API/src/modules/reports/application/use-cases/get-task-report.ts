import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type TaskReportQueryInput,
  taskReportQuerySchema,
} from "@/modules/reports/application/dto/task-report-dtos";
import type { TaskReportReadRepository } from "@/modules/reports/application/ports/task-report-read-repository";
import type { TaskReportReadModel } from "@/modules/reports/application/read-models/task-report";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export interface GetTaskReportCommand {
  actor: AuthenticatedUser;
  companyId: string;
  filters: Omit<TaskReportQueryInput, "page" | "limit"> & { page?: number; limit?: number };
}

export class GetTaskReport {
  constructor(
    private readonly repository: TaskReportReadRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: GetTaskReportCommand): Promise<TaskReportReadModel> {
    const parsed = taskReportQuerySchema.safeParse({ ...input.filters });
    if (!parsed.success) {
      throw new ValidationError("Filtros do relatório inválidos", {
        details: { issues: parsed.error.issues },
      });
    }
    this.authorization.assertCompanyContext(input.actor, input.companyId);
    this.authorization.assertPermission(input.actor, "tasks.read");
    await this.accessService.assertAccess(input.actor.userId, input.companyId);
    const company = await this.companyRepository.findById(input.companyId);
    if (!company?.isActive) throw new NotFoundError("Empresa não encontrada");
    const result = await this.repository.find({ companyId: input.companyId, ...parsed.data });
    return {
      companyId: input.companyId,
      items: result.items,
      total: result.total,
      page: parsed.data.page,
      limit: parsed.data.limit,
      hasMore: parsed.data.page * parsed.data.limit < result.total,
    };
  }
}
