import { describe, expect, it, vi } from "vitest";

import { CalculateCapacity } from "@/modules/capacity/application/use-cases/calculate-capacity";
import { BusinessCalendar } from "@/modules/capacity/domain/services/business-calendar";
import { CapacityCalculator } from "@/modules/capacity/domain/services/capacity-calculator";
import { Company } from "@/modules/companies/domain/entities/company";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { User } from "@/modules/users/domain/entities/user";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import {
  CapacityConfigurationMissingError,
  CapacityZeroError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/typed-errors";
import {
  InMemoryCompanyCapacitySettingsRepository,
  InMemoryDeveloperAvailabilityRepository,
} from "@/test/fakes/capacity-fakes";
import {
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
  InMemoryUserRepository,
} from "@/test/fakes/identity-fakes";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const DEVELOPER_ID = "44444444-4444-4444-8444-444444444444";

const startDate = new Date("2026-08-14T09:30:00.000Z");

async function build() {
  const companies = new InMemoryCompanyRepository();
  const memberships = new InMemoryMembershipRepository();
  const users = new InMemoryUserRepository();
  const settings = new InMemoryCompanyCapacitySettingsRepository();
  const availability = new InMemoryDeveloperAvailabilityRepository(companies, memberships, users);
  const calculator = new CapacityCalculator(new BusinessCalendar());

  await companies.create(Company.create({ name: "A" }, COMPANY_A));
  await companies.create(Company.create({ name: "B" }, COMPANY_B));
  await users.create(
    User.create({ email: "actor@example.com", name: "Actor", passwordHash: "hash" }, USER_ID),
  );
  await memberships.create(
    Membership.create({ companyId: COMPANY_A, userId: USER_ID, position: "GESTOR" }),
  );

  return {
    companies,
    memberships,
    users,
    settings,
    availability,
    calculator,
    useCase: new CalculateCapacity(
      availability,
      settings,
      companies,
      new MembershipAccessService(memberships),
      new AuthorizationService(),
      calculator,
    ),
  };
}

function actor(
  permissions: AuthenticatedUser["permissions"] = ["capacity.read"],
  companyId = COMPANY_A,
): AuthenticatedUser {
  return { userId: USER_ID, companyId, permissions };
}

async function addDeveloper(context: Awaited<ReturnType<typeof build>>): Promise<void> {
  await context.users.create(
    User.create(
      { email: "developer@example.com", name: "Developer", passwordHash: "hash" },
      DEVELOPER_ID,
    ),
  );
  await context.memberships.create(
    Membership.create({ companyId: COMPANY_A, userId: DEVELOPER_ID, position: "DESENVOLVEDOR" }),
  );
}

function command(
  changes: Partial<Parameters<Awaited<ReturnType<typeof build>>["useCase"]["execute"]>[0]> = {},
) {
  return {
    actor: actor(),
    companyId: COMPANY_A,
    startDate,
    estimatedHours: 12,
    ...changes,
  };
}

describe("CalculateCapacity", () => {
  it("integra disponibilidade, configuração e o CapacityCalculator", async () => {
    const context = await build();
    await addDeveloper(context);
    await context.settings.setDailyHoursPerDeveloper(COMPANY_A, 6);
    const calculate = vi.spyOn(context.calculator, "calculate");

    await expect(context.useCase.execute(command())).resolves.toMatchObject({
      companyId: COMPANY_A,
      estimatedHours: 12,
      availableDevelopers: 1,
      dailyHoursPerDeveloper: 6,
      dailyCapacity: 6,
      requiredDays: 2,
      plannedDeliveryDate: new Date("2026-08-18T09:30:00.000Z"),
    });
    expect(calculate).toHaveBeenCalledWith({
      startDate,
      estimatedHours: 12,
      availableDevelopers: 1,
      dailyHoursPerDeveloper: 6,
      holidays: undefined,
    });
  });

  it("aceita estimativa zero, frações e encaminha feriados", async () => {
    const context = await build();
    await addDeveloper(context);
    await context.settings.setDailyHoursPerDeveloper(COMPANY_A, 8);
    const holidays = [new Date("2026-08-17T00:00:00.000Z")];
    const originalStart = startDate.getTime();
    const originalHoliday = holidays[0]?.getTime();

    const result = await context.useCase.execute(command({ estimatedHours: 10, holidays }));
    expect(result).toMatchObject({ dailyCapacity: 8, requiredDays: 1.25 });
    expect(result.plannedDeliveryDate).toEqual(new Date("2026-08-19T09:30:00.000Z"));
    expect(startDate.getTime()).toBe(originalStart);
    expect(holidays[0]?.getTime()).toBe(originalHoliday);

    await expect(context.useCase.execute(command({ estimatedHours: 0 }))).resolves.toMatchObject({
      requiredDays: 0,
      plannedDeliveryDate: startDate,
    });
  });

  it("rejeita configuração ausente e capacidade zero com códigos explícitos", async () => {
    const context = await build();
    await expect(context.useCase.execute(command())).rejects.toBeInstanceOf(
      CapacityConfigurationMissingError,
    );

    await context.settings.setDailyHoursPerDeveloper(COMPANY_A, 8);
    await expect(context.useCase.execute(command())).rejects.toBeInstanceOf(CapacityZeroError);
  });

  it.each([
    ["companyId", { companyId: "invalid" }],
    ["data", { startDate: new Date("invalid") }],
    ["estimativa negativa", { estimatedHours: -1 }],
    ["NaN", { estimatedHours: Number.NaN }],
    ["Infinity", { estimatedHours: Number.POSITIVE_INFINITY }],
  ])("rejeita %s antes de consultar dependências", async (_label, changes) => {
    const context = await build();
    const count = vi.spyOn(context.availability, "countAvailableDevelopers");
    const getSettings = vi.spyOn(context.settings, "getDailyHoursPerDeveloper");

    await expect(context.useCase.execute(command(changes))).rejects.toBeInstanceOf(ValidationError);
    expect(count).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("exige capacity.read, membership ativa e contexto tenant-aware", async () => {
    const context = await build();
    const noPermission = command({ actor: actor(["tasks.read"]) });
    await expect(context.useCase.execute(noPermission)).rejects.toBeInstanceOf(ForbiddenError);

    const membership = await context.memberships.findByUserAndCompany(USER_ID, COMPANY_A);
    membership?.deactivate();
    if (membership) await context.memberships.update(membership);
    await expect(context.useCase.execute(command())).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      context.useCase.execute(command({ actor: actor(["capacity.read"], COMPANY_B) })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejeita empresa inexistente ou inativa e não consulta capacidade", async () => {
    const context = await build();
    const count = vi.spyOn(context.availability, "countAvailableDevelopers");
    await context.settings.setDailyHoursPerDeveloper(COMPANY_B, 8);
    await context.memberships.create(
      Membership.create({ companyId: COMPANY_B, userId: USER_ID, position: "GESTOR" }),
    );
    await context.users.create(
      User.create(
        { email: "developer-b@example.com", name: "Developer B", passwordHash: "hash" },
        DEVELOPER_ID,
      ),
    );
    await context.memberships.create(
      Membership.create({ companyId: COMPANY_B, userId: DEVELOPER_ID, position: "DESENVOLVEDOR" }),
    );
    const missingActor = actor(["capacity.read"], COMPANY_B);

    await expect(
      context.useCase.execute(command({ actor: missingActor, companyId: COMPANY_B })),
    ).resolves.toBeDefined();
    count.mockClear();
    const missingCompanyId = "99999999-9999-4999-8999-999999999999";
    await context.memberships.create(
      Membership.create({ companyId: missingCompanyId, userId: USER_ID, position: "GESTOR" }),
    );
    await expect(
      context.useCase.execute(
        command({
          actor: actor(["capacity.read"], missingCompanyId),
          companyId: missingCompanyId,
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    const company = await context.companies.findById(COMPANY_B);
    company?.deactivate();
    if (company) await context.companies.update(company);
    await expect(
      context.useCase.execute(command({ actor: missingActor, companyId: COMPANY_B })),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(count).not.toHaveBeenCalledWith(COMPANY_B);
  });

  it("não usa Tasks, Requisitions, TimeEntries ou pausas e mantém o calculator como fonte da fórmula", async () => {
    const context = await build();
    await addDeveloper(context);
    await context.settings.setDailyHoursPerDeveloper(COMPANY_A, 8);
    const calculate = vi.spyOn(context.calculator, "calculate");

    await context.useCase.execute(command());

    expect(calculate).toHaveBeenCalledTimes(1);
    expect(context.useCase).not.toHaveProperty("taskRepository");
    expect(context.useCase).not.toHaveProperty("requisitionRepository");
  });
});
