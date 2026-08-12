import type { RequisitionNumberGenerator } from "@/modules/requisitions/application/ports/requisition-number-generator";
import type { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type { RequisitionAssignee } from "@/modules/requisitions/domain/entities/requisition-assignee";
import type { RequisitionAssigneeRepository } from "@/modules/requisitions/domain/repositories/requisition-assignee-repository";
import type {
  ListRequisitionsFilters,
  RequisitionRepository,
} from "@/modules/requisitions/domain/repositories/requisition-repository";

export class InMemoryRequisitionRepository implements RequisitionRepository {
  private readonly items = new Map<string, Requisition>();

  async create(requisition: Requisition): Promise<Requisition> {
    this.items.set(requisition.id, requisition);
    return requisition;
  }

  async findById(id: string): Promise<Requisition | null> {
    return this.items.get(id) ?? null;
  }

  async update(requisition: Requisition): Promise<Requisition> {
    this.items.set(requisition.id, requisition);
    return requisition;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async listByCompany(
    companyId: string,
    filters: ListRequisitionsFilters = {},
  ): Promise<Requisition[]> {
    return [...this.items.values()]
      .filter(
        (requisition) =>
          requisition.companyId === companyId &&
          (filters.status === undefined || requisition.status === filters.status) &&
          (filters.priority === undefined || requisition.priority === filters.priority) &&
          (filters.responsibleId === undefined ||
            requisition.responsibleId === filters.responsibleId) &&
          (filters.search === undefined ||
            requisition.title.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()) ||
            (/^\d+$/.test(filters.search) && requisition.number === Number(filters.search))),
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }
}

export class InMemoryRequisitionAssigneeRepository implements RequisitionAssigneeRepository {
  private readonly items = new Map<string, RequisitionAssignee>();

  async findByRequisitionAndUser(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee | null> {
    return (
      [...this.items.values()].find(
        (assignee) =>
          assignee.companyId === companyId &&
          assignee.requisitionId === requisitionId &&
          assignee.userId === userId,
      ) ?? null
    );
  }

  async create(
    companyId: string,
    requisitionId: string,
    userId: string,
  ): Promise<RequisitionAssignee> {
    const existing = await this.findByRequisitionAndUser(companyId, requisitionId, userId);
    if (existing) return existing;

    const assignee = { companyId, requisitionId, userId, createdAt: new Date() };
    this.items.set(this.key(companyId, requisitionId, userId), assignee);
    return assignee;
  }

  async delete(companyId: string, requisitionId: string, userId: string): Promise<void> {
    this.items.delete(this.key(companyId, requisitionId, userId));
  }

  async listByRequisition(
    companyId: string,
    requisitionId: string,
  ): Promise<RequisitionAssignee[]> {
    return [...this.items.values()]
      .filter(
        (assignee) => assignee.companyId === companyId && assignee.requisitionId === requisitionId,
      )
      .sort((left, right) => {
        const createdAtDifference = left.createdAt.getTime() - right.createdAt.getTime();
        return createdAtDifference || left.userId.localeCompare(right.userId);
      });
  }

  private key(companyId: string, requisitionId: string, userId: string): string {
    return `${companyId}:${requisitionId}:${userId}`;
  }
}

export class FakeRequisitionNumberGenerator implements RequisitionNumberGenerator {
  private readonly counters = new Map<string, number>();

  async next(companyId: string): Promise<number> {
    const nextNumber = (this.counters.get(companyId) ?? 0) + 1;
    this.counters.set(companyId, nextNumber);
    return nextNumber;
  }
}
