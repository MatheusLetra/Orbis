import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import { companies, memberships, users } from "@/infrastructure/database/schema";
import { CalculateCapacity } from "@/modules/capacity/application/use-cases/calculate-capacity";
import { BusinessCalendar } from "@/modules/capacity/domain/services/business-calendar";
import { CapacityCalculator } from "@/modules/capacity/domain/services/capacity-calculator";
import { DrizzleCompanyCapacitySettingsRepository } from "@/modules/capacity/infrastructure/repositories/drizzle-company-capacity-settings-repository";
import { DrizzleDeveloperAvailabilityRepository } from "@/modules/capacity/infrastructure/repositories/drizzle-developer-availability-repository";
import { DrizzleCompanyRepository } from "@/modules/companies/infrastructure/repositories/drizzle-company-repository";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import {
  CapacityConfigurationMissingError,
  CapacityZeroError,
  ForbiddenError,
  NotFoundError,
} from "@/shared/errors/typed-errors";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const COMPANY_INACTIVE = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "44444444-4444-4444-8444-444444444444";
const DEVELOPER_A_ID = "55555555-5555-4555-8555-555555555555";
const DEVELOPER_B_ID = "66666666-6666-4666-8666-666666666666";
const startDate = new Date("2026-08-14T09:30:00.000Z");

describe.skipIf(!available)("CalculateCapacity PostgreSQL", () => {
  let db: Database;
  let calculate: CalculateCapacity;

  beforeAll(async () => {
    db = await createTestDatabase();
    const companyRepository = new DrizzleCompanyRepository(db);
    const membershipRepository = new DrizzleMembershipRepository(db);
    calculate = new CalculateCapacity(
      new DrizzleDeveloperAvailabilityRepository(db),
      new DrizzleCompanyCapacitySettingsRepository(db),
      companyRepository,
      new MembershipAccessService(membershipRepository),
      new AuthorizationService(),
      new CapacityCalculator(new BusinessCalendar()),
    );
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE memberships, companies, users CASCADE;`);
    await db.insert(companies).values([
      { id: COMPANY_A, name: "Tenant A", timezone: "UTC", dailyHoursPerDeveloper: 8 },
      { id: COMPANY_B, name: "Tenant B", timezone: "UTC", dailyHoursPerDeveloper: 6 },
      { id: COMPANY_INACTIVE, name: "Inactive", timezone: "UTC", isActive: false },
    ]);
    await db.insert(users).values([
      { id: ACTOR_ID, email: "actor-capacity@example.com", name: "Actor", passwordHash: "hash" },
      {
        id: DEVELOPER_A_ID,
        email: "developer-a-capacity@example.com",
        name: "Developer A",
        passwordHash: "hash",
      },
      {
        id: DEVELOPER_B_ID,
        email: "developer-b-capacity@example.com",
        name: "Developer B",
        passwordHash: "hash",
      },
    ]);
    await db.insert(memberships).values([
      { companyId: COMPANY_A, userId: ACTOR_ID, position: "GESTOR" },
      { companyId: COMPANY_A, userId: DEVELOPER_A_ID, position: "DESENVOLVEDOR" },
      { companyId: COMPANY_B, userId: DEVELOPER_B_ID, position: "DESENVOLVEDOR" },
    ]);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  function actor(companyId = COMPANY_A): AuthenticatedUser {
    return { userId: ACTOR_ID, companyId, permissions: ["capacity.read"] };
  }

  it("calcula capacidade e previsão com configuração e desenvolvedor ativos", async () => {
    await expect(
      calculate.execute({
        actor: actor(),
        companyId: COMPANY_A,
        startDate,
        estimatedHours: 12,
      }),
    ).resolves.toMatchObject({
      companyId: COMPANY_A,
      availableDevelopers: 1,
      dailyHoursPerDeveloper: 8,
      dailyCapacity: 8,
      requiredDays: 1.5,
      plannedDeliveryDate: new Date("2026-08-18T09:30:00.000Z"),
    });
  });

  it("distingue configuração ausente de capacidade zero", async () => {
    await db.execute(
      sql`UPDATE companies SET daily_hours_per_developer = NULL WHERE id = ${COMPANY_A}`,
    );
    await expect(
      calculate.execute({
        actor: actor(),
        companyId: COMPANY_A,
        startDate,
        estimatedHours: 1,
      }),
    ).rejects.toBeInstanceOf(CapacityConfigurationMissingError);

    await db.execute(
      sql`UPDATE companies SET daily_hours_per_developer = 8 WHERE id = ${COMPANY_A}`,
    );
    await db.execute(
      sql`UPDATE memberships SET is_active = false WHERE company_id = ${COMPANY_A} AND user_id = ${DEVELOPER_A_ID}`,
    );
    await expect(
      calculate.execute({
        actor: actor(),
        companyId: COMPANY_A,
        startDate,
        estimatedHours: 1,
      }),
    ).rejects.toBeInstanceOf(CapacityZeroError);
  });

  it("considera somente usuário ativo, membership ativa e posição DESENVOLVEDOR", async () => {
    await db.execute(sql`UPDATE users SET is_active = false WHERE id = ${DEVELOPER_A_ID}`);
    await expect(
      calculate.execute({
        actor: actor(),
        companyId: COMPANY_A,
        startDate,
        estimatedHours: 1,
      }),
    ).rejects.toBeInstanceOf(CapacityZeroError);
  });

  it("preserva isolamento tenant-aware e rejeita empresa inativa", async () => {
    await expect(
      calculate.execute({
        actor: actor(),
        companyId: COMPANY_B,
        startDate,
        estimatedHours: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      calculate.execute({
        actor: actor(),
        companyId: COMPANY_INACTIVE,
        startDate,
        estimatedHours: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("retorna NotFound para empresa inativa com membership ativa do ator", async () => {
    await db.insert(memberships).values({
      companyId: COMPANY_INACTIVE,
      userId: ACTOR_ID,
      position: "GESTOR",
    });
    await expect(
      calculate.execute({
        actor: actor(COMPANY_INACTIVE),
        companyId: COMPANY_INACTIVE,
        startDate,
        estimatedHours: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
