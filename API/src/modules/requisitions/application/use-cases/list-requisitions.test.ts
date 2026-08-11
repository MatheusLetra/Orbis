import { describe, expect, it } from "vitest";

import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { ListRequisitions } from "@/modules/requisitions/application/use-cases/list-requisitions";
import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import type {
  ListRequisitionsFilters,
  RequisitionRepository,
} from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, ValidationError } from "@/shared/errors/typed-errors";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";

const ACTOR_ID = "actor-1";
const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";
const RESPONSIBLE_ID = "11111111-1111-4111-8111-111111111111";

class InMemoryRequisitionRepository implements RequisitionRepository {
  private readonly items = new Map<string, Requisition>();
  receivedCompanyId: string | null = null;
  receivedFilters: ListRequisitionsFilters | undefined;

  seed(requisition: Requisition): void {
    this.items.set(requisition.id, requisition);
  }

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

  async listByCompany(
    companyId: string,
    filters: ListRequisitionsFilters = {},
  ): Promise<Requisition[]> {
    this.receivedCompanyId = companyId;
    this.receivedFilters = filters;

    return [...this.items.values()]
      .filter((requisition) => requisition.companyId === companyId)
      .filter((requisition) => !filters.status || requisition.status === filters.status)
      .filter((requisition) => !filters.priority || requisition.priority === filters.priority)
      .filter(
        (requisition) =>
          !filters.responsibleId || requisition.responsibleId === filters.responsibleId,
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }
}

function build() {
  const requisitionRepository = new InMemoryRequisitionRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const useCase = new ListRequisitions(requisitionRepository, accessService, authorization);

  return { useCase, requisitionRepository, membershipRepository };
}

async function activeActor(
  membershipRepository: InMemoryMembershipRepository,
  companyId = COMPANY_ID,
): Promise<AuthenticatedUser> {
  await membershipRepository.create(
    Membership.create({ companyId, userId: ACTOR_ID, position: "GESTOR" }),
  );

  return {
    userId: ACTOR_ID,
    companyId,
    permissions: ["requisitions.read"],
  };
}

function requisition(
  id: string,
  companyId: string,
  options: {
    status?: "OPEN" | "IN_PROGRESS" | "PAUSED" | "DONE" | "CANCELLED";
    priority?: "LOW" | "MEDIUM" | "HIGH";
    responsibleId?: string | null;
    createdAt?: Date;
  } = {},
): Requisition {
  const createdAt = options.createdAt ?? new Date("2026-08-11T10:00:00Z");

  return Requisition.restore({
    id,
    companyId,
    number: Number(id.replace(/\D/g, "")) || 1,
    title: `Requisição ${id}`,
    description: null,
    priority: options.priority ?? "MEDIUM",
    status: options.status ?? "OPEN",
    requesterId: "requester-1",
    responsibleId: options.responsibleId ?? null,
    systemId: null,
    systemVersionId: null,
    estimatedHours: null,
    startDate: null,
    plannedDeliveryDate: null,
    deliveredAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}

describe("ListRequisitions", () => {
  it("lista requisições da empresa do ator em createdAt ascendente", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(
      requisition("req-2", COMPANY_ID, { createdAt: new Date("2026-08-12T00:00:00Z") }),
    );
    dependencies.requisitionRepository.seed(
      requisition("req-1", COMPANY_ID, { createdAt: new Date("2026-08-11T00:00:00Z") }),
    );
    dependencies.requisitionRepository.seed(requisition("req-3", OTHER_COMPANY_ID));

    const output = await dependencies.useCase.execute({ actor });

    expect(output.map((item) => item.id)).toEqual(["req-1", "req-2"]);
    expect(dependencies.requisitionRepository.receivedCompanyId).toBe(COMPANY_ID);
  });

  it("lista vazia retorna []", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    await expect(dependencies.useCase.execute({ actor })).resolves.toEqual([]);
  });

  it.each([
    ["status", { status: "DONE" as const }, "req-done"],
    ["priority", { priority: "HIGH" as const }, "req-high"],
    ["responsibleId", { responsibleId: RESPONSIBLE_ID }, "req-responsible"],
  ])("filtra por %s", async (_name, filters, matchingId) => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition(matchingId, COMPANY_ID, filters));
    dependencies.requisitionRepository.seed(requisition("req-other", COMPANY_ID));

    const output = await dependencies.useCase.execute({ actor, filters });

    expect(output.map((item) => item.id)).toEqual([matchingId]);
  });

  it("combina filtros", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(
      requisition("req-match", COMPANY_ID, {
        status: "IN_PROGRESS",
        priority: "HIGH",
        responsibleId: RESPONSIBLE_ID,
      }),
    );
    dependencies.requisitionRepository.seed(
      requisition("req-status", COMPANY_ID, {
        status: "IN_PROGRESS",
        priority: "LOW",
        responsibleId: RESPONSIBLE_ID,
      }),
    );

    const output = await dependencies.useCase.execute({
      actor,
      filters: {
        status: "IN_PROGRESS",
        priority: "HIGH",
        responsibleId: RESPONSIBLE_ID,
      },
    });

    expect(output.map((item) => item.id)).toEqual(["req-match"]);
  });

  it("retorna [] quando o filtro não encontra dados", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(requisition("req-1", COMPANY_ID));

    await expect(
      dependencies.useCase.execute({ actor, filters: { status: "CANCELLED" } }),
    ).resolves.toEqual([]);
  });

  it("exige requisitions.read", async () => {
    const dependencies = build();
    await dependencies.membershipRepository.create(
      Membership.create({ companyId: COMPANY_ID, userId: ACTOR_ID, position: "SUPORTE" }),
    );

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: [] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejeita membership inativa", async () => {
    const dependencies = build();
    const membership = Membership.create({
      companyId: COMPANY_ID,
      userId: ACTOR_ID,
      position: "GESTOR",
    });
    membership.deactivate();
    await dependencies.membershipRepository.create(membership);

    await expect(
      dependencies.useCase.execute({
        actor: { userId: ACTOR_ID, companyId: COMPANY_ID, permissions: ["requisitions.read"] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("mapeia a saída com toRequisitionOutput", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);
    dependencies.requisitionRepository.seed(
      requisition("req-1", COMPANY_ID, { responsibleId: RESPONSIBLE_ID }),
    );

    const [output] = await dependencies.useCase.execute({ actor });

    expect(output).toMatchObject({
      id: "req-1",
      companyId: COMPANY_ID,
      responsibleId: RESPONSIBLE_ID,
      title: "Requisição req-1",
    });
    expect(output.createdAt).toBe("2026-08-11T10:00:00.000Z");
  });

  it("não aceita companyId, paginação ou busca textual nos filtros", async () => {
    const dependencies = build();
    const actor = await activeActor(dependencies.membershipRepository);

    await expect(
      dependencies.useCase.execute({
        actor,
        filters: { companyId: COMPANY_ID } as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      dependencies.useCase.execute({
        actor,
        filters: { page: 1 } as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      dependencies.useCase.execute({
        actor,
        filters: { search: "requisição" } as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
