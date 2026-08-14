import { describe, expect, it } from "vitest";
import { GetDailyHoursPerDeveloper } from "@/modules/capacity/application/use-cases/get-daily-hours-per-developer";
import { SetDailyHoursPerDeveloper } from "@/modules/capacity/application/use-cases/set-daily-hours-per-developer";
import { Company } from "@/modules/companies/domain/entities/company";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { User } from "@/modules/users/domain/entities/user";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";
import { InMemoryCompanyCapacitySettingsRepository } from "@/test/fakes/capacity-fakes";
import {
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
  InMemoryUserRepository,
} from "@/test/fakes/identity-fakes";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

async function build() {
  const companies = new InMemoryCompanyRepository();
  const memberships = new InMemoryMembershipRepository();
  const users = new InMemoryUserRepository();
  const settings = new InMemoryCompanyCapacitySettingsRepository();
  await companies.create(Company.create({ name: "A" }, COMPANY_A));
  await companies.create(Company.create({ name: "B" }, COMPANY_B));
  await users.create(
    User.create({ email: "actor@example.com", name: "Actor", passwordHash: "hash" }, USER_ID),
  );
  await memberships.create(
    Membership.create({ companyId: COMPANY_A, userId: USER_ID, position: "GESTOR" }),
  );
  const access = new MembershipAccessService(memberships);
  const authorization = new AuthorizationService();

  return {
    companies,
    memberships,
    settings,
    get: new GetDailyHoursPerDeveloper(settings, companies, access, authorization),
    set: new SetDailyHoursPerDeveloper(settings, companies, access, authorization),
  };
}

function actor(permissions: AuthenticatedUser["permissions"]): AuthenticatedUser {
  return { userId: USER_ID, companyId: COMPANY_A, permissions };
}

describe("daily hours use cases", () => {
  it("retorna null quando a empresa ativa não está configurada", async () => {
    const context = await build();

    await expect(
      context.get.execute({ actor: actor(["capacity.read"]), companyId: COMPANY_A }),
    ).resolves.toEqual({ companyId: COMPANY_A, dailyHoursPerDeveloper: null });
  });

  it("lê e altera o valor da empresa sem alterar outra empresa", async () => {
    const context = await build();
    await context.settings.setDailyHoursPerDeveloper(COMPANY_B, 6.5);

    await expect(
      context.set.execute({
        actor: actor(["company.update"]),
        companyId: COMPANY_A,
        dailyHoursPerDeveloper: 7.5,
      }),
    ).resolves.toBe(7.5);
    await expect(
      context.get.execute({ actor: actor(["capacity.read"]), companyId: COMPANY_A }),
    ).resolves.toMatchObject({ dailyHoursPerDeveloper: 7.5 });
    await expect(context.settings.getDailyHoursPerDeveloper(COMPANY_B)).resolves.toBe(6.5);
  });

  it.each([
    ["zero", 0],
    ["negativo", -1],
    ["acima do limite", 24.01],
    ["fracionário com mais de duas casas", 1.001],
    ["NaN", NaN],
    ["Infinity", Infinity],
  ])("rejeita valor %s", async (_label, value) => {
    const context = await build();

    await expect(
      context.set.execute({
        actor: actor(["company.update"]),
        companyId: COMPANY_A,
        dailyHoursPerDeveloper: value,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("exige as permissões específicas de leitura e alteração", async () => {
    const context = await build();

    await expect(
      context.get.execute({ actor: actor(["company.update"]), companyId: COMPANY_A }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      context.set.execute({
        actor: actor(["capacity.read"]),
        companyId: COMPANY_A,
        dailyHoursPerDeveloper: 8,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejeita empresa inexistente, inativa, membership inativa e contexto cross-tenant", async () => {
    const context = await build();
    const missingCompanyId = "99999999-9999-4999-8999-999999999999";
    await context.memberships.create(
      Membership.create({ companyId: missingCompanyId, userId: USER_ID, position: "GESTOR" }),
    );

    await expect(
      context.get.execute({
        actor: { ...actor(["capacity.read"]), companyId: missingCompanyId },
        companyId: missingCompanyId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const company = await context.companies.findById(COMPANY_A);
    company?.deactivate();
    if (company) await context.companies.update(company);
    await expect(
      context.get.execute({ actor: actor(["capacity.read"]), companyId: COMPANY_A }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      context.get.execute({ actor: actor(["capacity.read"]), companyId: "invalid" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      context.set.execute({
        actor: { ...actor(["company.update"]), companyId: COMPANY_B },
        companyId: COMPANY_A,
        dailyHoursPerDeveloper: 8,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const membership = await context.memberships.findByUserAndCompany(USER_ID, COMPANY_A);
    membership?.deactivate();
    if (membership) await context.memberships.update(membership);
    await expect(
      context.set.execute({
        actor: actor(["company.update"]),
        companyId: COMPANY_A,
        dailyHoursPerDeveloper: 8,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
